require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function createAdmin() {
  console.log("Creating admin user...");
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'owner@superbrain.com',
    password: 'admin123',
    email_confirm: true,
    user_metadata: {
      full_name: 'Admin',
      username: 'Admin'
    }
  });

  if (error) {
    console.error("Error creating user:", error);
    return;
  }

  console.log("User created successfully:", data.user.id);
  
  // Also upsert into profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: data.user.id,
      email: 'owner@superbrain.com',
      full_name: 'Admin',
      username: 'Admin'
    });

  if (profileError) {
    console.error("Error creating profile:", profileError);
  } else {
    console.log("Profile created successfully!");
  }
}

createAdmin();
