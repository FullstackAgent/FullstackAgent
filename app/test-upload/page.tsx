'use client';

import { useState } from 'react';

/**
 * FileBrowser Upload Test Page
 *
 * Test page to debug file upload and authentication issues
 */
export default function TestUploadPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Test configuration
  const [config, setConfig] = useState({
    url: 'https://dd-xeuqsjxc-filebrowser.usw.sealos.io',
    username: 'admin',
    password: 'admin',
    path: '/',
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResult('Starting upload with JWT...\n');

    try {
      // Step 1: Login to get JWT token
      setResult(prev => prev + `\n1. Logging in...\n`);

      const loginResponse = await fetch(`${config.url}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: config.username,
          password: config.password,
          recaptcha: '',
        }),
      });

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        setResult(prev => prev + `   ❌ Login failed: ${errorText}\n`);
        return;
      }

      const token = await loginResponse.text();
      setResult(prev => prev + `   ✅ Got JWT token\n`);

      // Step 2: Try TUS upload (correct method)
      setResult(prev => prev + `\n2. Uploading file via TUS...\n`);
      setResult(prev => prev + `   File: ${file.name} (${file.size} bytes)\n`);

      // TUS: Create upload
      const createUrl = `${config.url}/api/tus/${encodeURIComponent(file.name)}?override=false`;
      setResult(prev => prev + `   Creating: ${createUrl}\n`);

      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'X-Auth': token,
          'Upload-Length': file.size.toString(),
          'Tus-Resumable': '1.0.0',
        },
      });

      setResult(prev => prev + `   Create status: ${createResponse.status} ${createResponse.statusText}\n`);

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        setResult(prev => prev + `   ❌ Create failed: ${errorText}\n`);
        return;
      }

      // TUS: Upload file content
      const uploadUrl = `${config.url}/api/tus/${encodeURIComponent(file.name)}`;
      setResult(prev => prev + `\n3. Uploading content...\n`);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          'X-Auth': token,
          'Content-Type': 'application/offset+octet-stream',
          'Upload-Offset': '0',
          'Tus-Resumable': '1.0.0',
        },
        body: file,
      });

      setResult(prev => prev + `   Upload status: ${uploadResponse.status} ${uploadResponse.statusText}\n`);

      if (uploadResponse.ok) {
        setResult(prev => prev + `   ✅ Upload successful!\n`);
        setResult(prev => prev + `\n4. Verifying file exists...\n`);

        // Verify file exists
        const verifyResponse = await fetch(`${config.url}/api/resources${config.path}`, {
          method: 'GET',
          headers: {
            'X-Auth': token,
          },
        });

        if (verifyResponse.ok) {
          const data = await verifyResponse.json();
          const uploaded = data.items?.find((item: any) => item.name === file.name);
          if (uploaded) {
            setResult(prev => prev + `   ✅ File verified: ${uploaded.path}\n`);
          } else {
            setResult(prev => prev + `   ⚠️  File not found in listing\n`);
          }
        }
      } else {
        const errorText = await uploadResponse.text();
        setResult(prev => prev + `   ❌ Upload failed: ${errorText}\n`);
      }

    } catch (error) {
      setResult(prev => prev + `❌ Exception: ${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setLoading(true);
    setResult('Testing JWT authentication...\n');

    try {
      // Step 1: Login to get JWT token
      setResult(prev => prev + `\n1. Logging in to ${config.url}/api/login\n`);

      const loginResponse = await fetch(`${config.url}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: config.username,
          password: config.password,
          recaptcha: '',
        }),
      });

      setResult(prev => prev + `   Status: ${loginResponse.status} ${loginResponse.statusText}\n`);

      if (!loginResponse.ok) {
        const errorText = await loginResponse.text();
        setResult(prev => prev + `   ❌ Login failed: ${errorText}\n`);
        return;
      }

      const token = await loginResponse.text();
      setResult(prev => prev + `   ✅ Got JWT token: ${token.substring(0, 50)}...\n`);

      // Step 2: Test API with JWT token
      setResult(prev => prev + `\n2. Testing GET ${config.url}/api/resources/\n`);

      const response = await fetch(`${config.url}/api/resources/`, {
        method: 'GET',
        headers: {
          'X-Auth': token,
        },
      });

      setResult(prev => prev + `   Status: ${response.status} ${response.statusText}\n`);

      if (response.ok) {
        const data = await response.json();
        setResult(prev => prev + `   ✅ API call successful!\n${JSON.stringify(data, null, 2)}\n`);
      } else {
        const errorText = await response.text();
        setResult(prev => prev + `   ❌ API call failed: ${errorText}\n`);
      }

    } catch (error) {
      setResult(prev => prev + `❌ Exception: ${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">FileBrowser Upload Test</h1>

      {/* Configuration */}
      <div className="bg-gray-100 p-6 rounded-lg mb-6 space-y-4">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>

        <div>
          <label className="block text-sm font-medium mb-1">FileBrowser URL</label>
          <input
            type="text"
            value={config.url}
            onChange={(e) => setConfig(prev => ({ ...prev, url: e.target.value }))}
            className="w-full px-3 py-2 border rounded"
            placeholder="https://example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              value={config.username}
              onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Upload Path</label>
          <input
            type="text"
            value={config.path}
            onChange={(e) => setConfig(prev => ({ ...prev, path: e.target.value }))}
            className="w-full px-3 py-2 border rounded"
            placeholder="/"
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={testAuth}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Test Auth
          </button>

          <label className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 cursor-pointer inline-block">
            {loading ? 'Uploading...' : 'Upload File'}
            <input
              type="file"
              onChange={handleFileSelect}
              disabled={loading}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Results */}
      <div className="bg-black text-green-400 p-6 rounded-lg font-mono text-sm">
        <h2 className="text-xl font-semibold mb-4">Results</h2>
        <pre className="whitespace-pre-wrap">{result || 'No results yet...'}</pre>
      </div>
    </div>
  );
}
