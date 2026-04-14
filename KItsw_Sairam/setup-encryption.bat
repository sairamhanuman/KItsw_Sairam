@echo off
echo ============================================================
echo  KITSW QP Setting — Encryption Setup
echo  Run this ONCE on your server machine
echo ============================================================

echo.
echo [1/2] Installing Python msoffcrypto-tool...
pip install msoffcrypto-tool

echo.
echo [2/2] Verifying installation...
python -c "import msoffcrypto; print('SUCCESS: msoffcrypto-tool is ready')"

echo.
echo ============================================================
echo  IMPORTANT: Make sure your ESE Template .doc files
echo  do NOT have any existing password set on them.
echo  The server will now encrypt them fresh with each send.
echo ============================================================
pause
