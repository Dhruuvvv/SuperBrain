import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://ohdctclxfozczjqglaku.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9oZGN0Y2x4Zm96Y3pqcWdsYWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyMjc1NDUsImV4cCI6MjA4MTgwMzU0NX0.de6FEtD4BndLVXLLPkszQjEJwLTLsAcAK-k4B9z10wA"

export const supabase = createClient(supabaseUrl, supabaseKey)
