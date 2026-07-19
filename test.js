fetch("https://omnia-api.vercel.app/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@omnia.local", password: "Admin123!" })
})
.then(async (res) => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
})
.catch(console.error);
