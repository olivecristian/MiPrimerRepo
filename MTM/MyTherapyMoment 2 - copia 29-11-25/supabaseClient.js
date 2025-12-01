import { createClient } from 'https://esm.sh/@supabase/supabase-js'

// ⛔ Reemplazá estos valores con los de tu proyecto
const supabaseUrl = 'https://fuhhpbfwdudvqqinexrq.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1aGhwYmZ3ZHVkdnFxaW5leHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzMjIyODIsImV4cCI6MjA3OTg5ODI4Mn0.apJy8zCCHJu1uRoJjmiYEtSQ8FCoUgLSeQoji1dvCIk'

export const supabase = createClient(supabaseUrl, supabaseKey)


