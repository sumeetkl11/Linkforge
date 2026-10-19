import { execSync } from 'child_process';

const RENDER_SERVICE_ID = 'srv-da0mpbgjo6nc73etnhmg';
const RENDER_API_KEY = process.env.RENDER_API_KEY || 'rnd_uOsiuHsYoiEB1JWeGwrmvU4Mq4Vx';

async function deployBackend() {
  console.log('🚀 Triggering Render Backend deploy...');
  try {
    const res = await fetch(`https://api.render.com/v1/services/${RENDER_SERVICE_ID}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ clearCache: 'do_not_clear' })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }
    console.log(`✅ Render deploy initiated! Status: ${data.status}, Deploy ID: ${data.id}`);
  } catch (err) {
    console.error('❌ Failed to trigger Render deploy:', err.message);
    process.exit(1);
  }
}

function deployFrontend() {
  console.log('🚀 Deploying Frontend to Vercel Production...');
  try {
    execSync('npx vercel --prod --yes', { stdio: 'inherit' });
    console.log('✅ Vercel production deploy complete!');
  } catch (err) {
    console.error('❌ Failed to deploy to Vercel:', err.message);
    process.exit(1);
  }
}

const target = process.argv[2] || 'all';

if (target === 'frontend') {
  deployFrontend();
} else if (target === 'backend') {
  await deployBackend();
} else if (target === 'all') {
  deployFrontend();
  await deployBackend();
}
