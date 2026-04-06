import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yszmjhrdvdjhidtfyjnx.supabase.co';
const supabaseAnonKey = 'sb_publishable_ETHGyGZpx8hWPZcx7DSfdg_2tsAEAKk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
