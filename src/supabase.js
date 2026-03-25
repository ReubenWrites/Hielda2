import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oufopsyfxhdtexkbjfop.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_PwZkfVCzv94VV8szuWVPfg_L2DA3h2q'

export const supabase = createClient(supabaseUrl, supabaseKey)
