'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function DebugPage() {
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSessionData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-session');
      const data = await response.json();
      setSessionData(data);
    } catch (error) {
      console.error('Error fetching session:', error);
      setSessionData({ error: 'Failed to fetch session data' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionData();
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Debug Session Info</h1>

        <Card className="bg-gray-900 border-gray-800 mb-4">
          <CardHeader>
            <CardTitle className="text-white">Current Session Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-800 rounded">
                  <p className="text-sm text-gray-400 mb-2">Authenticated:</p>
                  <p className="font-mono">
                    {sessionData?.authenticated ? (
                      <span className="text-green-400">✓ Yes</span>
                    ) : (
                      <span className="text-red-400">✗ No</span>
                    )}
                  </p>
                </div>

                {sessionData?.session && (
                  <div className="p-4 bg-gray-800 rounded">
                    <p className="text-sm text-gray-400 mb-2">Session User:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(sessionData.session.user, null, 2)}
                    </pre>
                  </div>
                )}

                {sessionData?.dbUser && (
                  <div className="p-4 bg-gray-800 rounded">
                    <p className="text-sm text-gray-400 mb-2">Database User:</p>
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(sessionData.dbUser, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="p-4 bg-gray-800 rounded">
                  <p className="text-sm text-gray-400 mb-2">Full Response:</p>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(sessionData, null, 2)}
                  </pre>
                </div>

                <Button
                  onClick={fetchSessionData}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  Refresh Session Data
                </Button>

                {!sessionData?.authenticated && (
                  <div className="mt-4 p-4 bg-yellow-900 rounded">
                    <p className="text-yellow-200">You are not logged in. Please login first:</p>
                    <a href="/login">
                      <Button className="mt-2 bg-white text-black hover:bg-gray-200">
                        Go to Login
                      </Button>
                    </a>
                  </div>
                )}

                {sessionData?.authenticated && sessionData?.dbUser && (
                  <div className="mt-4 p-4 bg-green-900 rounded">
                    <p className="text-green-200 mb-2">Your Projects:</p>
                    {sessionData.dbUser.projects?.map((project: any) => (
                      <div key={project.id} className="mb-2">
                        <a
                          href={`/projects/${project.id}`}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          {project.name} ({project.status}) - ID: {project.id}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
