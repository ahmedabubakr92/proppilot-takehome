import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

type Agency = {
    id: string;
    name: string;
    slug: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function ContactFormPage() {
    const { agencySlug } = useParams<{ agencySlug: string }>();

    const [agency, setAgency] = useState<Agency | null>(null);
    const [loadingAgency, setLoadingAgency] = useState(true);

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [message, setMessage] = useState("")
    const [formStatus, setFormStatus] = useState<FormStatus>("idle");
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!agencySlug) return
        let cancelled = false

        const fetchAgency = async () => {
            const { data, error } = await supabase
                .from('agencies')
                .select('id, slug, name')
                .eq('slug', agencySlug)
                .maybeSingle()

            if (cancelled) return

            if (error) {
                console.error('Agency lookup failed:', error)
                setAgency(null)
            } else {
                setAgency(data)
            }
            setLoadingAgency(false)
        }

        fetchAgency()
        return () => { cancelled = true }
    }, [agencySlug])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!agency) return

        setFormStatus("submitting")
        setErrorMessage(null)

        const { error } = await supabase
            .from("contacts")
            .insert({
                agency_id: agency.id,
                name: name.trim(),
                email: email.trim(),
                message: message.trim(),
            })

        if (error) {
            console.error("Contact submission failed:", error)
            setErrorMessage(error.message)
            setFormStatus("error")
        } else {
            setFormStatus("success")
            setName("")
            setEmail("")
            setMessage("")
        }
    }

    if (loadingAgency) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500">Loading...</p>
            </div>
        )
    }

    if (!agency) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <div className="max-w-md text-center">
                    <h1 className="text-2xl font-semibold text-slate-800 mb-2">Agency not found</h1>
                    <p className="text-slate-600">We couldn't find an agency with the slug "{agencySlug}".</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-12">
            <div className="max-w-lg mx-auto">
                <h1 className="text-3xl font-semibold text-slate-900 mb-2">
                    Contact {agency.name}
                </h1>
                <p className="text-slate-600 mb-8">
                    Leave your details and an agent will get back to you.
                </p>

                {formStatus === "success" ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <h2 className="font-medium text-green-900 mb-1">Thanks!</h2>
                        <p className="text-green-800 text-sm">
                            Your message has been sent. An agent will be in touch shortly.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                            <input
                                type="text"
                                id="name"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input
                                type="email"
                                id="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>

                        <div>
                            <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-1">Message</label>
                            <textarea
                                id="message"
                                required
                                rows={5}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                            />
                        </div>

                        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

                        <button
                            type="submit"
                            disabled={formStatus === "submitting"}
                            className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {formStatus === 'submitting' ? 'Sending…' : 'Send message'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}