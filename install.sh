#!/usr/bin/env bash
# Installe les dépendances et build le dashboard.
set -e
echo "[1/3] Dépendances du bot..."
npm install
echo "[2/3] Dépendances + build du dashboard..."
( cd dashboard-client && npm install && npm run build )
echo "[3/3] OK. Lance le bot avec :  npm start"
