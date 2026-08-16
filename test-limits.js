const Groq = require('groq-sdk');
require('dotenv').config({ path: '.env.local' });

async function testGroq() {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await client.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 8000,
    });
    console.log('Groq Success');
  } catch (err) {
    console.error('Groq Error:', err.message);
  }
}

async function testNvidia() {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta/llama-3.1-70b-instruct',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 8000,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    console.log('Nvidia Success');
  } catch (err) {
    console.error('Nvidia Error:', err.message);
  }
}

testGroq().then(testNvidia);
