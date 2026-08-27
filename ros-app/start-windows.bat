@echo off
echo ==========================================
echo  ROASTERY OS - WINDOWS SERVER DEPLOYMENT
echo ==========================================
echo.

echo 1. Pulling latest changes from Git (if any)...
git pull origin main
echo.

echo 2. Installing dependencies...
call pnpm install
echo.

echo 3. Generating Prisma Client and Database Migration...
call npx prisma generate
:: uncomment the line below if you want to auto-migrate db on start
:: call npx prisma migrate deploy
echo.

echo 4. Building Next.js App...
call pnpm run build
echo.

echo 5. Starting / Restarting PM2...
call npx pm2 start ecosystem.config.js
call npx pm2 save
echo.

echo ==========================================
echo  DEPLOYMENT COMPLETE!
echo  Check status with: npx pm2 status
echo  View logs with: npx pm2 logs
echo ==========================================
pause
