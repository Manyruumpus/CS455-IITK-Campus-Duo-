import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useDemoAuth } from '@/app/context/DemoAuthContext';

export const ProfilePage: React.FC = () => {
  const { session } = useDemoAuth();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Student Profile"
        subtitle="Manage your academic verification details and enrolled coursework."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Profile', isCurrent: true },
        ]}
      />

      <Card variant="default">
        <CardHeader>
          <CardTitle>Academic Enrollment Credentials</CardTitle>
          <CardDescription>Verified through IIT Kanpur CC directory.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Full Name" defaultValue={session?.name || 'Mohit Kumar'} disabled />
            <Input label="Campus Email" defaultValue={session?.email || 'mohit@iitk.ac.in'} disabled />
            <Input label="Roll Number" defaultValue={session?.rollNumber || '210642'} disabled />
            <Input label="Department" defaultValue="Computer Science & Engineering" disabled />
          </div>

          <div>
            <label className="block text-xs font-medium text-craft-muted uppercase tracking-wider mb-2">
              Active Courses
            </label>
            <div className="flex flex-wrap gap-2">
              <Badge variant="mono">CS455: Computer Networks</Badge>
              <Badge variant="mono">CS632: Advanced Compilers</Badge>
              <Badge variant="mono">ESC102: Introduction to Electronics</Badge>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button variant="outline" size="sm" disabled>
            Course Changes Gated by CC
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
