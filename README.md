# Fulling - AI-Powered Full-Stack Development Platform

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15.5.4-black?style=for-the-badge&logo=next.js" alt="Next.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/PostgreSQL-14-blue?style=for-the-badge&logo=postgresql" alt="PostgreSQL"/>
  <img src="https://img.shields.io/badge/Kubernetes-1.28-326ce5?style=for-the-badge&logo=kubernetes" alt="Kubernetes"/>
  <img src="https://img.shields.io/badge/Claude_Code-AI-purple?style=for-the-badge" alt="Claude Code"/>
</div>

## 🚀 Overview

Fulling provides a sandboxed environment with Claude Code and PostgreSQL — everything you need to vibe code full-stack apps.

Fulling automatically sets up the following for your project, ready in a minute:
• Next.js environment with shadcn/ui
• Dedicated PostgreSQL (pre-configured)
• Claude Code (pre-configured)
• A live domain

<img width="1511" height="775" alt="image" src="https://github.com/user-attachments/assets/4683a22c-800b-45b7-91a3-6ed5114ea3c9" />

<img width="1200" height="768" alt="image" src="https://github.com/user-attachments/assets/45aca3d0-f722-401c-9d63-9ca14957d338" />


### ✨ Key Features

Fulling is designed to streamline the entire full-stack development lifecycle using an AI-centric approach. Its core capabilities are delivered through a highly orchestrated, self-contained development sandbox:

* **Pre-Configured AI Development Environment:**
    * A complete, immediately usable development environment is provisioned, featuring **Next.js**, **shadcn/ui**, and the **Claude Code CLI**.
    * Essential AI-related environment variables (e.g., `BASE_URL`, `KEY`, etc.) are automatically configured and injected, allowing the AI agent to begin coding instantly without manual setup.

* **Isolated PostgreSQL Database Provisioning:**
    * A dedicated and isolated **PostgreSQL** database instance is automatically created for each project using **KubeBlocks**.
    * The database connection string is securely injected into the development environment as an environment variable (`DATABASE_URL`), ensuring the AI can access and configure the persistence layer.

* **Automated Public Endpoint and Domain Mapping:**
    * Multiple accessible subdomains are automatically allocated and managed (**HTTPS ingress with SSL termination**).
    * These subdomains are configured to map to the specific application ports you wish to expose (e.g., ports 3000, 5000, 8080), providing immediate external access for testing and live development.

* **Natural Language Interaction via Web Terminal:**
    * All core development and configuration tasks are performed through a built-in **Web Terminal (ttyd)** using natural language instructions.
    * This provides a direct, low-friction interface for interacting with the AI engineer, receiving code, running commands, and monitoring the development process.

* **AI-Aware Business Configuration:**
    * Specific business configurations, such as **OAuth settings** (e.g., GitHub authentication) and **Payment configurations**, can be fed into the platform.
    * This configuration metadata is made accessible as contextual prompts, allowing the Claude Code agent to intelligently perceive and implement corresponding features (e.g., configuring NextAuth) directly into the generated code.

* **Seamless GitHub Repository Integration:**
    * The platform is designed for easy association with an external **GitHub repository**.
    * This facilitates standard code repository management, version control, and collaboration by connecting the AI's generated code to your preferred source control workflow.

* **Automated High-Availability Deployment:**
    * Projects can be automatically deployed from the development sandbox to a high-availability production environment, leveraging the underlying **Kubernetes** infrastructure.
    * This aims to abstract away the complexities of deployment, allowing the AI to manage the transition from development to live application.

## Star Fulling on GitHub can get the latest released information.

![star-demo](https://github.com/user-attachments/assets/bc497e0b-bd23-4ded-a231-1e382d56f92e)

## 🏗️ Architecture

### System Architecture

```
                                                                        ┌─────────────────┐                             
                                                                        │ Ingress Domain  │                             
                                                                        └─────────────────┘                             
                                                                                │                                           
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐  
│                 │     │                 │     │                 │     │  Sandbox Pods   │  
│   Web Browser   │────▶│     Fulling     │────▶│   Kubernetes    │────▶│  (with Claude)  │  
│                 │     │                 │     │     Cluster     │     └─────────────────┘
└─────────────────┘     └─────────────────┘     └─────────────────┘             │                       
                               │                         │                      │                      
                               │                         ▼                      │                      
                               │                 ┌─────────────────┐            │                      
                               │                 │   PostgreSQL    │────────────┘
                               │                 └─────────────────┘
                               ▼                         
                        ┌─────────────────┐     
                        │     GitHub      │     
                        │  Repositories   │     
                        └─────────────────┘     
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15.5.4 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: Shadcn/UI
- **State Management**: React Hooks

### Backend
- **Runtime**: Node.js
- **API**: Next.js API Routes
- **Database ORM**: Prisma
- **Authentication**: NextAuth v5 with GitHub OAuth

### Infrastructure
- **Container Orchestration**: Kubernetes
- **Database**: PostgreSQL (via KubeBlocks)
- **Web Terminal**: ttyd
- **Container Image**: fullstack-web-runtime (Custom Docker image with development tools)

## 📦 Installation

### Prerequisites

- Node.js 20.x or higher
- PostgreSQL database
- Kubernetes cluster with KubeBlocks installed
- GitHub OAuth application credentials

### Environment Setup

1. Clone the repository:
```bash
git clone https://github.com/FullstackAgent/fulling.git
cd fulling
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:

Create `.env.local` file:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fullstackagent"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"
AUTH_TRUST_HOST=""

# GitHub OAuth (replace with your actual values)
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# Sealos OAuth
SEALOS_JWT_SECRET=""

# job
DATABASE_LOCK_DURATION_SECONDS=""
MAX_DATABASES_PER_RECONCILE=""

SANDBOX_LOCK_DURATION_SECONDS=""
MAX_SANDBOXES_PER_RECONCILE=""

# k8s resource
RUNTIME_IMAGE=""

# aiproxy
AIPROXY_ENDPOINT=""
ANTHROPIC_BASE_URL=""

# Log
LOG_LEVEL="info"

# login
ENABLE_PASSWORD_AUTH=""
ENABLE_PASSWORD_AUTH=""
ENABLE_SEALOS_AUTH=""
```

6. Initialize database:
```bash
npx prisma generate
npx prisma db push
```

7. Run the development server:
```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

### Database Schema

prisma/schema.prisma

## 🚢 Deployment

### Kubernetes Resources

The platform creates the following Kubernetes resources for each project:

1. **Database Cluster** (KubeBlocks):
   - PostgreSQL 14.8.0
   - 3Gi storage
   - Auto-generated credentials

2. **Sandbox Deployment**:
   - Custom fullstack-web-runtime image
   - Claude Code CLI pre-installed
   - Web terminal (ttyd) on port 7681
   - Application ports: 3000, 5000, 8080

3. **Services & Ingress**:
   - Internal service for pod networking
   - HTTPS ingress with SSL termination
   - WebSocket support for terminal

### Resource Limits

Default resource allocation per sandbox:
- CPU: 200m limit, 20m request
- Memory: 256Mi limit, 25Mi request
- Storage: 3Gi for database

## 🔧 Development

### Project Structure

```
fullstack-agent/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── projects/          # Project management pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn/UI components
│   └── ...               # Feature components
├── lib/                   # Core libraries
│   ├── auth.ts           # NextAuth configuration
│   ├── db.ts             # Prisma client
│   ├── kubernetes.ts     # Kubernetes service
│   └── github.ts         # GitHub integration
├── prisma/               # Database schema
├── yaml/                 # Kubernetes templates
└── public/               # Static assets
```

### Key Services

#### KubernetesService (`lib/kubernetes.ts`)
- Manages all Kubernetes operations
- Creates databases and sandboxes
- Handles pod lifecycle management

#### Authentication (`lib/auth.ts`)
- GitHub OAuth integration
- Session management
- User authorization

#### Database (`lib/db.ts`)
- Prisma ORM configuration
- Connection pooling

## 📚 API Documentation

### Sandbox Management

#### Create Sandbox
```http
POST /api/sandbox/[projectId]
Content-Type: application/json

{
  "envVars": {
    "KEY": "value"
  }
}
```

#### Get Sandbox Status
```http
GET /api/sandbox/[projectId]
```

#### Delete Sandbox
```http
DELETE /api/sandbox/[projectId]
```

### Project Management

#### Create Project
```http
POST /api/projects
Content-Type: application/json

{
  "name": "project-name",
  "description": "Project description"
}
```

## 🔒 Security

- **Authentication**: GitHub OAuth ensures only authorized users can access the platform
- **Isolation**: Each sandbox runs in its own Kubernetes namespace
- **Secrets Management**: Sensitive data stored in Kubernetes secrets
- **Network Policies**: Sandboxes isolated from each other
- **Resource Limits**: Prevents resource exhaustion attacks

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://www.anthropic.com/) for Claude Code
- [Sealos](https://sealos.io/) for Kubernetes platform
- [ttyd](https://github.com/tsl0922/ttyd) for web terminal

## 📞 Contact

- GitHub: [@fanux](https://github.com/fanux)
- Issues: [GitHub Issues](https://github.com/FullstackAgent/FullstackAgent/issues)

---

<div align="center">
100% AI-generated code. Prompted by fanux. Thanks for Claude code & Opus & Sonnet 4.5 & GLM & Kimi K2 Thinking
</div>