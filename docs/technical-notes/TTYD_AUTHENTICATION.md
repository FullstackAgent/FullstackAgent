# ttyd Authentication Architecture

## Overview

This document explains the authentication mechanism used in FullstackAgent's terminal system and why it differs from ttyd's built-in authentication.

## Table of Contents

1. [Authentication Layers](#authentication-layers)
2. [ttyd's Built-in Authentication](#ttyds-built-in-authentication)
3. [FullstackAgent's Authentication](#fullstackagents-authentication)
4. [Why We Don't Use AuthToken](#why-we-dont-use-authtoken)
5. [Security Analysis](#security-analysis)
6. [Implementation Details](#implementation-details)

---

## Authentication Layers

ttyd supports three authentication layers:

| Layer | Purpose | Implementation | Status in FullstackAgent |
|-------|---------|----------------|--------------------------|
| **Layer 1: HTTP Authentication** | Protect WebSocket handshake | HTTP Basic Auth / Custom Header | ❌ Not Used |
| **Layer 2: WebSocket Authentication** | Validate first WebSocket message | `AuthToken` field in JSON message | ❌ Not Used |
| **Layer 3: Shell Script Authentication** | Validate before spawning shell | Custom shell script (ttyd-auth.sh) | ✅ **Used** |

---

## ttyd's Built-in Authentication

### How ttyd's `-c` Parameter Works

```bash
# Start ttyd with HTTP Basic Auth
ttyd -c "username:password" /bin/bash
```

**Internal Processing:**
1. ttyd Base64 encodes `username:password`
2. Stores result in `server->credential`
3. Validates at two levels:
   - **HTTP Layer**: Checks `Authorization` header during WebSocket handshake
   - **WebSocket Layer**: Checks `AuthToken` field in first JSON message

### WebSocket Authentication Message (ttyd Original Design)

```json
{
  "AuthToken": "Base64(username:password)",
  "columns": 80,
  "rows": 24
}
```

**Validation Code (ttyd source):**
```c
// protocol.c
case JSON_DATA:
  if (server->credential != NULL) {
    struct json_object *o = NULL;
    if (json_object_object_get_ex(obj, "AuthToken", &o)) {
      const char *token = json_object_get_string(o);
      if (token != NULL && !strcmp(token, server->credential))
        pss->authenticated = true;
      else
        lwsl_warn("WS authentication failed with token: %s\n", token);
    }
    if (!pss->authenticated) {
      lws_close_reason(wsi, LWS_CLOSE_STATUS_POLICY_VIOLATION, NULL, 0);
      return -1;  // Close WebSocket
    }
  }
  spawn_process(pss, columns, rows);
  break;
```

---

## FullstackAgent's Authentication

### Design Decisions

**Why Shell Script Authentication?**

1. ✅ **Single Token Simplicity** - No need for `username:password` format
2. ✅ **Environment Variable Security** - Token passed via Kubernetes Secrets
3. ✅ **Multi-Parameter Support** - Can pass SESSION_ID alongside token
4. ✅ **Flexibility** - Custom validation logic in bash script
5. ✅ **Process Isolation** - Works with Kubernetes exec constraints

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend: Generate Session ID                               │
├─────────────────────────────────────────────────────────────┤
│ terminalSessionId = `terminal-${Date.now()}-${random()}`   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ WebSocket URL: Pass token and session ID as URL params     │
├─────────────────────────────────────────────────────────────┤
│ wss://terminal.example.com/ws?arg=TOKEN&arg=SESSION_ID     │
│                                    ^^^^^      ^^^^^^^^^^    │
│                                    $1         $2            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ WebSocket Message: Send terminal size (NO AuthToken)       │
├─────────────────────────────────────────────────────────────┤
│ {                                                           │
│   "columns": 80,                                            │
│   "rows": 24                                                │
│ }                                                           │
│                                                             │
│ Note: AuthToken field removed because:                     │
│ - ttyd started without -c parameter                        │
│ - server->credential = NULL                                │
│ - WebSocket authentication not used                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ttyd: Trigger spawn_process()                              │
├─────────────────────────────────────────────────────────────┤
│ ttyd receives JSON message:                                │
│ - Extracts columns and rows                                │
│ - Skips AuthToken validation (credential = NULL)           │
│ - Calls spawn_process(pss, columns, rows)                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ ttyd: Build command with URL arguments                     │
├─────────────────────────────────────────────────────────────┤
│ Command: /usr/local/bin/ttyd-auth.sh TOKEN SESSION_ID      │
│                                        ^^^^^  ^^^^^^^^^^    │
│                                        $1     $2            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Shell Script: ttyd-auth.sh performs authentication          │
├─────────────────────────────────────────────────────────────┤
│ #!/bin/bash                                                 │
│ EXPECTED_TOKEN="${TTYD_ACCESS_TOKEN:-}"                    │
│ PROVIDED_TOKEN="$1"                                         │
│                                                             │
│ if [ "$PROVIDED_TOKEN" != "$EXPECTED_TOKEN" ]; then        │
│     echo "ERROR: Authentication failed"                    │
│     sleep infinity  # Block shell startup                  │
│ fi                                                          │
│                                                             │
│ # Optional: Store session PID                              │
│ if [ -n "$2" ]; then                                        │
│     SESSION_ID="$2"                                         │
│     echo "$$" > "/tmp/.terminal-session-${SESSION_ID}"     │
│ fi                                                          │
│                                                             │
│ exec /bin/bash  # Start shell                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Why We Don't Use AuthToken

### Technical Reasons

#### 1. **ttyd Started Without `-c` Parameter**

```bash
# sandbox/entrypoint.sh
ttyd -T xterm-256color -W -a -t "$THEME" /usr/local/bin/ttyd-auth.sh
#                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
#                                        Authentication delegated to script
#    ^^ -a: Allow URL arguments
#    No -c parameter → server->credential = NULL
```

**Result:**
- `server->credential = NULL`
- WebSocket authentication code skipped
- `AuthToken` field in JSON message is ignored

#### 2. **JSON Message Purpose**

The JSON message sent after WebSocket connection serves **three purposes**:

| Purpose | Required? | FullstackAgent Usage |
|---------|-----------|----------------------|
| Trigger `spawn_process()` | ✅ Required | ✅ Used |
| Initialize terminal size | ✅ Required | ✅ Used |
| Authenticate via AuthToken | ⚠️ Optional (if `-c` used) | ❌ Not Used |

**Code Evidence (ttyd protocol.c):**
```c
case JSON_DATA:
  if (pss->process != NULL) break;

  // Extract terminal size (REQUIRED)
  uint16_t columns = 0, rows = 0;
  json_object *obj = parse_window_size(pss->buffer, pss->len, &columns, &rows);

  // AuthToken validation (ONLY if server->credential != NULL)
  if (server->credential != NULL) {
    // ... validation code ...
  }

  // Spawn process (REQUIRED for shell startup)
  spawn_process(pss, columns, rows);
  break;
```

**Without JSON Message:**
- ❌ `spawn_process()` never called
- ❌ Shell never starts
- ❌ Terminal hangs forever

**With JSON Message (no AuthToken):**
- ✅ `spawn_process()` called
- ✅ Shell script receives URL arguments
- ✅ Script validates token from environment variable

#### 3. **Authentication Happens in Shell Script**

```bash
# sandbox/ttyd-auth.sh

# Environment variable set by Kubernetes
EXPECTED_TOKEN="${TTYD_ACCESS_TOKEN:-}"

# Provided via URL (?arg=TOKEN)
PROVIDED_TOKEN="$1"

# Validation
if [ "$PROVIDED_TOKEN" != "$EXPECTED_TOKEN" ]; then
    echo "ERROR: Authentication failed - invalid token"
    sleep infinity  # Block indefinitely (no shell access)
fi

# Success
echo "✓ Authentication successful"
exec /bin/bash
```

**Advantages:**
- 🔒 Token never appears in WebSocket messages
- 🔒 Token stored in Kubernetes Secrets (environment variable)
- 🔒 Validation happens at OS level (bash script)
- 🔒 Failed authentication blocks shell startup

---

## Security Analysis

### Comparison: WebSocket Auth vs Shell Script Auth

| Aspect | ttyd WebSocket Auth | FullstackAgent Shell Auth |
|--------|---------------------|---------------------------|
| **Token Storage** | Command line (`-c` parameter) | Environment variable (Kubernetes Secret) |
| **Token Visibility** | Visible in process list | Hidden (injected at runtime) |
| **Token Format** | `Base64(username:password)` | Any string (32+ random chars) |
| **Transmission** | WebSocket message (encrypted) | URL parameter + Script parameter |
| **Validation Point** | ttyd server (Layer 2) | Shell script (Layer 3) |
| **Multi-tenancy** | Single credential for all users | Per-project unique tokens |
| **Session Tracking** | Not supported | Supported (SESSION_ID) |

### Security Features in FullstackAgent

#### 1. **Token Generation**
```typescript
// app/api/projects/route.ts
const ttydAuthToken = generateRandomString(32);
// Example: "7a9f2e8d3c1b5a4e6f0d8c2a1b3e5f7a"
```

#### 2. **Token Storage**
```typescript
// Stored in database with encryption
const environment = await tx.environment.create({
  data: {
    projectId: project.id,
    key: 'TTYD_ACCESS_TOKEN',
    value: ttydAuthToken,
    category: EnvironmentCategory.TTYD,
    isSecret: true,  // Marked as secret
  },
});
```

#### 3. **Token Injection**
```typescript
// lib/events/sandbox/sandboxListener.ts
const projectEnvVars = await getProjectEnvironments(project.id);
// Includes TTYD_ACCESS_TOKEN

const sandboxInfo = await k8sService.createSandbox(
  project.name,
  sandbox.k8sNamespace,
  sandbox.sandboxName,
  projectEnvVars  // Injected into Kubernetes StatefulSet
);
```

#### 4. **Token Validation**
```bash
# sandbox/ttyd-auth.sh
# Runs inside container with environment variable injected by Kubernetes
EXPECTED_TOKEN="${TTYD_ACCESS_TOKEN:-}"
PROVIDED_TOKEN="$1"

if [ "$PROVIDED_TOKEN" != "$EXPECTED_TOKEN" ]; then
    sleep infinity  # No shell access
fi
```

### Attack Surface Analysis

| Attack Vector | ttyd WebSocket Auth | FullstackAgent Shell Auth |
|---------------|---------------------|---------------------------|
| **Process list exposure** | ⚠️ Token visible in `ps aux` | ✅ Token in environment (not visible) |
| **WebSocket intercept** | ⚠️ Token in WebSocket message | ✅ Token not in WebSocket message |
| **Replay attack** | ⚠️ Captured token can be reused | ⚠️ Captured token can be reused* |
| **Brute force** | ⚠️ Same token for all sessions | ✅ Per-project unique tokens |
| **Token rotation** | ❌ Requires ttyd restart | ✅ Update DB + restart pod |

*Note: Replay attacks mitigated by:
- Short-lived tokens (can implement expiration)
- Network-level security (HTTPS/WSS)
- Kubernetes network policies

---

## Implementation Details

### Frontend: Terminal Connection

**File:** `components/terminal/xterm-terminal.tsx`

```typescript
// Generate unique session ID per terminal instance
const terminalSessionId = useRef(
  `terminal-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

// Parse URL and add session ID
const parseUrl = (): { wsFullUrl: string; token: string } | null => {
  const url = new URL(wsUrl);
  const token = url.searchParams.get('arg') || '';

  if (!token) {
    console.error('[XtermTerminal] No authentication token found in URL');
    return null;
  }

  // Add session ID as second arg parameter
  url.searchParams.append('arg', terminalSessionId.current);

  const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsPath = url.pathname.replace(/\/$/, '') + '/ws';
  const wsFullUrl = `${wsProtocol}//${url.host}${wsPath}${url.search}`;

  return { wsFullUrl, token };
};

// WebSocket connection
socket.onopen = () => {
  // Send terminal size (AuthToken field removed)
  const initMsg = JSON.stringify({
    columns: terminal!.cols,
    rows: terminal!.rows,
  });
  socket?.send(textEncoder.encode(initMsg));
};
```

### Backend: Token Management

**File:** `app/api/projects/route.ts`

```typescript
// Create project with TTYD_ACCESS_TOKEN
const ttydAuthToken = generateRandomString(32);

const environment = await tx.environment.create({
  data: {
    projectId: project.id,
    key: 'TTYD_ACCESS_TOKEN',
    value: ttydAuthToken,
    category: EnvironmentCategory.TTYD,
    isSecret: true,
  },
});
```

**File:** `lib/events/sandbox/sandboxListener.ts`

```typescript
async function handleCreateSandbox(payload: SandboxEventPayload) {
  // Load environment variables (includes TTYD_ACCESS_TOKEN)
  const projectEnvVars = await getProjectEnvironments(project.id);

  // Inject into Kubernetes StatefulSet
  const sandboxInfo = await k8sService.createSandbox(
    project.name,
    sandbox.k8sNamespace,
    sandbox.sandboxName,
    projectEnvVars
  );
}
```

### Container: Authentication Script

**File:** `sandbox/ttyd-auth.sh`

```bash
#!/bin/bash
# ttyd authentication wrapper script
# Validates TTYD_ACCESS_TOKEN before granting shell access
#
# Arguments (passed via URL ?arg=...&arg=...):
#   $1 - TTYD_ACCESS_TOKEN (required)
#   $2 - TERMINAL_SESSION_ID (optional, for file upload directory tracking)

# Get expected token from environment variable (injected by Kubernetes)
EXPECTED_TOKEN="${TTYD_ACCESS_TOKEN:-}"

# Check if token is configured
if [ -z "$EXPECTED_TOKEN" ]; then
    echo "ERROR: TTYD_ACCESS_TOKEN is not configured"
    echo "Please contact your system administrator"
    sleep infinity
fi

# Check if token was provided as argument
if [ "$#" -lt 1 ]; then
    echo "ERROR: Authentication failed - no token provided"
    sleep infinity
fi

PROVIDED_TOKEN="$1"

# Validate token
if [ "$PROVIDED_TOKEN" != "$EXPECTED_TOKEN" ]; then
    echo "ERROR: Authentication failed - invalid token"
    sleep infinity
fi

# Authentication successful
echo "✓ Authentication successful"

# Optional: Handle terminal session ID for file upload directory tracking
if [ "$#" -ge 2 ] && [ -n "$2" ]; then
    TERMINAL_SESSION_ID="$2"
    export TERMINAL_SESSION_ID

    # Store shell PID in session file
    SESSION_FILE="/tmp/.terminal-session-${TERMINAL_SESSION_ID}"
    echo "$$" > "$SESSION_FILE"

    echo "✓ Terminal session: ${TERMINAL_SESSION_ID}"
fi

# Start bash shell
exec /bin/bash
```

**File:** `sandbox/entrypoint.sh`

```bash
#!/bin/bash
# Start ttyd with authentication wrapper

ttyd -T xterm-256color -W -a -t "$THEME" /usr/local/bin/ttyd-auth.sh
#    ^^                 ^^ ^^
#    |                  |  |
#    |                  |  +-- Allow URL arguments (?arg=...)
#    |                  +-- Allow client writes
#    +-- Terminal type
#
# Note: No -c parameter → server->credential = NULL
# Authentication delegated to ttyd-auth.sh script
```

---

## Environment Variable Requirements

### Required Environment Variables

| Variable | Purpose | Set By | Example Value |
|----------|---------|--------|---------------|
| `TTYD_ACCESS_TOKEN` | Authentication token | Kubernetes (from DB) | `7a9f2e8d3c1b5a4e6f0d8c2a1b3e5f7a` |
| `TERMINAL_SESSION_ID` | Session tracking (optional) | ttyd-auth.sh (from URL) | `terminal-1234567890-abc123` |

### Environment Variable Flow

```
Database
  ↓
Environment table (key='TTYD_ACCESS_TOKEN', isSecret=true)
  ↓
Kubernetes StatefulSet (env vars)
  ↓
Container process (environment variable)
  ↓
ttyd-auth.sh reads $TTYD_ACCESS_TOKEN
  ↓
Compares with $1 (from URL ?arg=TOKEN)
```

---

## Troubleshooting

### Issue: Terminal hangs on connection

**Symptoms:**
- WebSocket connects successfully
- No shell prompt appears
- Terminal stuck in loading state

**Cause:**
- `TTYD_ACCESS_TOKEN` environment variable not set in container
- Token mismatch between URL and environment variable

**Solution:**
```bash
# Check environment variable in container
kubectl exec -it <pod-name> -n <namespace> -- env | grep TTYD_ACCESS_TOKEN

# Check URL token
# Should match the value in database Environment table
```

### Issue: Authentication failed error

**Symptoms:**
- Error message: "ERROR: Authentication failed - invalid token"
- Shell never starts

**Cause:**
- Token in URL doesn't match `TTYD_ACCESS_TOKEN` environment variable

**Solution:**
1. Verify token in database:
   ```sql
   SELECT value FROM Environment
   WHERE key = 'TTYD_ACCESS_TOKEN' AND projectId = '<project-id>';
   ```

2. Verify token in URL:
   ```
   ttydUrl: "https://sandbox-ttyd.example.com?arg=<TOKEN>&arg=<SESSION_ID>"
   ```

3. Ensure they match

### Issue: Session tracking not working

**Symptoms:**
- File uploads go to root directory instead of current directory
- `/tmp/.terminal-session-*` file not found

**Cause:**
- SESSION_ID not passed in URL
- ttyd-auth.sh not storing PID

**Solution:**
1. Check URL has session ID:
   ```
   ?arg=<TOKEN>&arg=<SESSION_ID>
   ```

2. Verify session file created:
   ```bash
   kubectl exec -it <pod-name> -n <namespace> -- ls -la /tmp/.terminal-session-*
   ```

---

## References

- [ttyd GitHub Repository](https://github.com/tsl0922/ttyd)
- [ttyd Protocol Documentation](https://github.com/tsl0922/ttyd/blob/main/docs/protocol.md)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [FullstackAgent Architecture](./TECHNICAL_DOCUMENTATION.md)
- [ttyd server.c](https://github.com/tsl0922/ttyd/blob/eccebc6bb1dfbaf0c46f1fd9c53b89abc773784d/src/server.c)
- [ttyd protocol.c](https://github.com/tsl0922/ttyd/blob/eccebc6bb1dfbaf0c46f1fd9c53b89abc773784d/src/protocol.c)
- [ttyd xterm](https://github.com/tsl0922/ttyd/blob/eccebc6bb1dfbaf0c46f1fd9c53b89abc773784d/html/src/components/terminal/xterm/index.ts#L264)

---

## Changelog

- **2025-01-19**: Initial documentation
- **2025-01-19**: Removed AuthToken field from WebSocket message (not needed)

---

## Related Files

- `components/terminal/xterm-terminal.tsx` - Frontend terminal component
- `sandbox/ttyd-auth.sh` - Authentication script
- `sandbox/entrypoint.sh` - Container entrypoint
- `app/api/projects/route.ts` - Token generation
- `lib/events/sandbox/sandboxListener.ts` - Token injection
- `lib/k8s/sandbox-manager.ts` - Kubernetes resource management
