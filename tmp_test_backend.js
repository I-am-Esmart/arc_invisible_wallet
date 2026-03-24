const https = require('https');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request(
      {
        hostname: 'arcinvisiblewallet.vercel.app',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let b = ''
        res.on('data', (c) => (b += c))
        res.on('end', () => resolve({ status: res.statusCode, body: b }))
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(
        { hostname: 'arcinvisiblewallet.vercel.app', path },
        (res) => {
          let b = ''
          res.on('data', (c) => (b += c))
          res.on('end', () => resolve({ status: res.statusCode, body: b }))
        }
      )
      .on('error', reject)
  })
}

;(async () => {
  console.log('Login...')
  const login = await post('/auth/login', { email: 'test@example.com' })
  console.log(login.status, login.body)
  const user = JSON.parse(login.body)

  console.log('Balance before', await get(`/balance?address=${encodeURIComponent(user.address)}`))
  console.log('Send tx...')
  const send = await post('/send-transaction', {
    to: '0x82B7fbD694b3Bca2D0A2294A57cA3776d5CA5D16',
    amount: '0.003',
    email: user.email,
  })
  console.log(send.status, send.body)

  console.log('Balance after', await get(`/balance?address=${encodeURIComponent(user.address)}`))
  console.log('Tx history', await get(`/txs?address=${encodeURIComponent(user.address)}`))
})()
