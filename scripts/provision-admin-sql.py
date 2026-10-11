#!/usr/bin/env python3
"""Generate a one-time SQL INSERT for one BeatOnStep catalogue administrator.

Runs entirely offline. No password is stored in source files or GitHub.
Paste the generated INSERT into the console for the verified production D1 DB.
"""
import getpass
import hashlib
import re
import secrets

print("BeatOnStep · admin catalogue — D1 SQL (offline)")
print("Cible D1 attendue : beatonstep-catalog-prod")
print("Database ID : 278e152c-3338-4e0d-adfd-673eac7c60cb")
email = input("E-mail administrateur : ").strip().lower()
if len(email) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
    raise SystemExit("Adresse e-mail invalide.")

password = getpass.getpass("Nouveau mot de passe (16 à 128 caractères) : ")
if not 16 <= len(password) <= 128:
    raise SystemExit("Mot de passe invalide ; utiliser au moins 16 caractères.")
if getpass.getpass("Confirmer le mot de passe : ") != password:
    raise SystemExit("Les mots de passe diffèrent.")

salt = secrets.token_bytes(16)
digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000, dklen=32)
safe_email = email.replace("'", "''")

print("\nCopier UNIQUEMENT cette requête SQL dans la console D1 de la bonne base :\n")
print(
    "INSERT INTO admin_users (email, password_salt, password_hash) VALUES "
    f"('{safe_email}', '{salt.hex()}', '{digest.hex()}');"
)
print("\nNe pas committer cette requête ni la transmettre dans une conversation.")
print("Elle contient une empreinte du mot de passe ; conserver le mot de passe en lieu sûr.")
