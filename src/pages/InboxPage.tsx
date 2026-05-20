import { useState, useEffect, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../lib/auth"

type ContactStatus = 'new' | 'contacted' | 'discarded'

type Contact = {
    id: string
    name: string
    email: string
    message: string
    status: ContactStatus
    created_at: string
}

const STATUS_OPTIONS: ContactStatus[] = ['new', 'contacted', 'discarded']

export default function InboxPage() {
    const { user } = useAuth()

    const [contactsById, setContactsById] = useState<Map<string, Contact>>(new Map())
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [agencyName, setAgencyName] = useState<string | null>(null)

    const contacts = useMemo(() => {
        return Array.from(contactsById.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
    }, [contactsById])

    useEffect(() => {
        let cancelled = false

        const fetchData = async () => {
            const [contactsResult, profileResult] = await Promise.all([
                supabase
                    .from("contacts")
                    .select('id, name, email, message, status, created_at')
                    .order('created_at', { ascending: false }),
                supabase
                    .from("profiles")
                    .select("agency_id, agencies(name)")
                    .single(),
            ])

            if (cancelled) return

            if (contactsResult.error) {
                setError(contactsResult.error.message)
                setLoading(false)
                return
            }

            // Merge fetched contacts into the Map. If realtime already
            // added a row, this just overwrites with the same data.
            setContactsById((prev) => {
                const next = new Map(prev)
                for (const row of contactsResult.data ?? []) {
                    next.set(row.id, row as Contact)
                }
                return next
            })

            const profileData = profileResult.data
            if (profileData?.agencies) {
                const agency = Array.isArray(profileData.agencies)
                    ? profileData.agencies[0]
                    : profileData.agencies
                setAgencyName(agency?.name ?? null)
            }

            setLoading(false)
        }

        fetchData()

        // Subscribe to realtime. RLS still applies — agents only
        // receive events for rows their SELECT policy allows.
        const channel = supabase
            .channel('contacts-inbox')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'contacts' },
                (payload) => {
                    const newRow = payload.new as Contact
                    setContactsById((prev) => {
                        const next = new Map(prev)
                        next.set(newRow.id, newRow)
                        return next
                    })
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'contacts' },
                (payload) => {
                    const updatedRow = payload.new as Contact
                    setContactsById((prev) => {
                        const next = new Map(prev)
                        next.set(updatedRow.id, updatedRow)
                        return next
                    })
                }
            )
            .subscribe()

        return () => {
            cancelled = true
            supabase.removeChannel(channel)
        }
    }, [])

    const handleStatusChange = async (contactId: string, newStatus: ContactStatus) => {
        const previous = contactsById.get(contactId)
        if (!previous) return

        // Optimistic update
        setContactsById((prev) => {
            const next = new Map(prev)
            next.set(contactId, { ...previous, status: newStatus })
            return next
        })

        const { error } = await supabase
            .from('contacts')
            .update({ status: newStatus })
            .eq('id', contactId)

        if (error) {
            console.error('Status update failed:', error)
            setContactsById((prev) => {
                const next = new Map(prev)
                next.set(contactId, previous)
                return next
            })
            setError(error.message)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <p className="text-slate-500">Loading inbox…</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="border-b border-slate-200 bg-white">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900">
                            {agencyName ? `${agencyName} — Inbox` : 'Inbox'}
                        </h1>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="text-sm text-slate-600 hover:text-slate-900"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {contacts.length === 0 ? (
                    <p className="text-slate-500 text-sm">No contacts yet.</p>
                ) : (
                    <ul className="space-y-3">
                        {contacts.map((contact) => (
                            <li
                                key={contact.id}
                                className="bg-white border border-slate-200 rounded-lg p-4"
                            >
                                <div className="flex items-start justify-between gap-4 mb-2">
                                    <div>
                                        <p className="font-medium text-slate-900">{contact.name}</p>
                                        <p className="text-sm text-slate-600">{contact.email}</p>
                                    </div>
                                    <select
                                        value={contact.status}
                                        onChange={(e) =>
                                            handleStatusChange(contact.id, e.target.value as ContactStatus)
                                        }
                                        className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white"
                                    >
                                        {STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{contact.message}</p>
                                <p className="text-xs text-slate-400 mt-2">
                                    {new Date(contact.created_at).toLocaleString()}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    )
}