const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

/* ========================
   SECURITY MIDDLEWARE
======================== */
app.use(helmet());
app.use(express.json());

// basic rate limit (anti spam / abuse)
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // limit each IP to 60 requests/min
  message: { error: "Too many requests, slow down." }
});

app.use(limiter);

/* ========================
   SINX CORE (kept but improved)
======================== */
const KEY = process.env.SINX_KEY || "SINX";

// encode
function sinxEncode(str, key = KEY) {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += ("0" + code.toString(16)).slice(-2);
  }
  return result;
}

// verify auth (stronger validation)
function verifySinxAuth(timestamp, authHeader) {
  if (!timestamp || !authHeader) return false;

  const parts = authHeader.split('.');
  if (parts.length !== 2) return false;

  const [ts, hash] = parts;

  // must match timestamp exactly
  if (ts !== timestamp) return false;

  let expected = "";
  for (let i = 0; i < timestamp.length; i++) {
    const code = timestamp.charCodeAt(i) ^ KEY.charCodeAt(i % KEY.length);
    expected += ("0" + code.toString(16)).slice(-2);
  }

  return hash === expected;
}

/* ========================
   HEALTH CHECK (important for Render)
======================== */
app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    service: "SINX Proxy",
    time: Date.now()
  });
});

/* ========================
   MAIN API
======================== */
app.get('/api.php', (req, res) => {
  const file = req.query.file;
  const t = req.query._t;
  const auth = req.headers['x-sinx-auth'];

  // security fail fast
  if (!auth || !verifySinxAuth(t, auth)) {
    return res.status(403).json({
      status: "error",
      message: "SINX auth failed"
    });
  }

  // route system
  if (file === "assetindexer") {
    const data = {
      status: "ok",
      assets: [
        { id: 1, name: "weapon_ak47", hash: "a1b2c3d4", size: 2048 },
        { id: 2, name: "skin_dragon", hash: "e5f6g7h8", size: 4096 },
        { id: 3, name: "map_city", hash: "i9j0k1l2", size: 8192 }
      ],
      timestamp: Date.now()
    };

    const json = JSON.stringify(data);
    const hex = sinxEncode(json);

    return res.json({
      status: "ok",
      encoding: "sinx-hex",
      payload: hex
    });
  }

  return res.status(404).json({
    status: "error",
    message: "Unknown endpoint"
  });
});

/* ========================
   GLOBAL ERROR HANDLER
======================== */
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    status: "error",
    message: "Internal server error"
  });
});

/* ========================
   START SERVER
======================== */
app.listen(PORT, () => {
  console.log(`🚀 SINX PRO running on port ${PORT}`);
});