@echo off
cd /d "%~dp0"
echo Demarrage du serveur sur http://127.0.0.1:5000
echo.
echo Une fois le message "serving on http://127.0.0.1:5000" affiche, ouvrez votre navigateur a cette adresse.
echo.
npm run dev
pause
