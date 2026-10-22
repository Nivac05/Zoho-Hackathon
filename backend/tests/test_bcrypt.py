from flask import Flask
from flask_bcrypt import Bcrypt
import time

app = Flask(__name__)
bcrypt = Bcrypt(app)

print("Starting bcrypt test...")
start = time.time()
password = "password123"
hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")
print(f"Generated hash in {time.time() - start:.2f} seconds")

start = time.time()
valid = bcrypt.check_password_hash(hashed_pw, password)
print(f"Checked hash in {time.time() - start:.2f} seconds, result: {valid}")
