@echo off
cd /d "C:\Users\Pichau\Desktop\cassino aluga"
set "VITE_SUPABASE_URL=https://wtqooyktcikmwketcpyr.supabase.co"
set "VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cW9veWt0Y2lrbXdrZXRjcHlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MjIyNTEsImV4cCI6MjA4NTk5ODI1MX0.IETr9ulWQIhOXmQJ15_0b5ZAdatkp9-MAfkFPq-9_Ws"
set "VITE_SUPABASE_BUCKET=property-images"
if not exist node_modules npm install
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
