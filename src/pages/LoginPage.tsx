import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"

type LoginStatus = 'idle' | 'submitting' | 'error'

export default function LoginPage() {
    const navigate = useNavigate()
    const { session, loading } = useAuth()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [status, setStatus] = useState<LoginStatus>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    // If already logged in, navigate to inbox
    useEffect(() => {
        if (!loading && session) {
            navigate("/inbox", { replace: true })
        }
    }, [loading, session, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus("submitting")
        setErrorMessage(null)

        const { error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
        })

        if (error) {
            setErrorMessage(error.message)
            setStatus("error")
            return
        }

        setStatus("idle")
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <h1 className="text-3xl font-semibold text-slate-900 mb-2">Agent sign-in</h1>
                <p className="text-slate-600 text-sm mb-8">
                    Access your agency's contact inbox
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                    </div>

                    {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

                    <button
                        type="submit"
                        disabled={status === 'submitting'}
                        className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {status === 'submitting' ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    )

}