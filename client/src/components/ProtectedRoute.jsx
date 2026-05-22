import { useEffect, useState } from "react"
import { supabase } from "../utils/supabaseClient"
import { Navigate } from "react-router-dom"

export default function ProtectedRoute({ children }) {

    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState(null)

    useEffect(() => {

        supabase.auth.getUser().then(({ data }) => {

            setUser(data.user)
            setLoading(false)

        })

    }, [])

    if (loading) return <p>Loading...</p>

    if (!user) {
        return <Navigate to="/login" />
    }

    return children

}
