import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="text-2xl font-bold mb-2 inline-block">
            Intent<span className="text-blue-600">Draw</span>
          </Link>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" disabled />
          </div>

          <Button className="w-full" disabled>Sign In</Button>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-amber-800 text-sm">
              🔒 Auth implemented in Phase 4. Use dashboard directly for now.
            </p>
          </div>

          <Button className="w-full" asChild>
            <Link href="/dashboard">Go to Dashboard →</Link>
          </Button>

          <p className="text-center text-sm text-slate-500">
            No account? <Link href="/signup" className="text-blue-600 hover:underline">Sign up</Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}