
import os
import shutil
import subprocess
import sys
import time

def run_command(command, cwd=None, shell=True):
    """Run a shell command and exit on failure."""
    print(f"[{cwd or '.'}] Executing: {command}")
    try:
        subprocess.check_call(command, cwd=cwd, shell=shell)
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {command}")
        sys.exit(1)

def main():
    print("========================================")
    print("   MIDI-Navigate Build Script")
    print("========================================")

    root_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(root_dir, "dist")
    temp_frontend_dir = os.path.join(root_dir, "dist_frontend_temp")

    # 1. Check for basic tools
    try:
        subprocess.check_output([sys.executable, "-m", "PyInstaller", "--version"], shell=True)
    except Exception:
        print("Error: PyInstaller not found. Please run: pip install pyinstaller")
        sys.exit(1)

    # 2. Build Frontend
    print("\n--- Step 1: Building Frontend ---")
    
    # Check if node_modules exists, logical heuristic to see if install needed
    if not os.path.exists(os.path.join(root_dir, "node_modules")):
        print("node_modules not found, running npm install...")
        run_command("npm install", cwd=root_dir)
    
    # Clean previous dist if exists (Vite does this usually, but good to be sure)
    if os.path.exists(dist_dir):
        print("Cleaning previous dist folder...")
        shutil.rmtree(dist_dir)

    print("Running Vite build...")
    run_command("npm run build", cwd=root_dir)

    # 3. Secure Frontend Build
    print("\n--- Step 2: Securing Frontend Assets ---")
    if os.path.exists(temp_frontend_dir):
        shutil.rmtree(temp_frontend_dir)
    
    if not os.path.exists(dist_dir):
        print("Error: Frontend build failed, dist folder missing.")
        sys.exit(1)

    print(f"Moving frontend build to temporary location: {temp_frontend_dir}")
    shutil.move(dist_dir, temp_frontend_dir)
    
    # 4. Build Backend
    print("\n--- Step 3: Building Backend (PyInstaller) ---")
    
    # Clean pyinstaller folders
    build_work_dir = os.path.join(root_dir, "build")
    if os.path.exists(build_work_dir):
        shutil.rmtree(build_work_dir)
    
    # dist dir is already gone (moved), so clean slate for PyInstaller
    
    # Invoke PyInstaller via python -m to use the current environment
    run_command(f'"{sys.executable}" -m PyInstaller MIDI-Navigate.spec --clean --noconfirm', cwd=root_dir)

    # 5. Merge Frontend into Backend Distribution
    print("\n--- Step 4: Merging Frontend into Distribution ---")
    
    target_dist_root = os.path.join(root_dir, "dist", "MIDI-Navigate")
    target_static_dir = os.path.join(target_dist_root, "dist") # main.py expects 'dist' folder next to exe
    
    if not os.path.exists(target_dist_root):
        print(f"Error: PyInstaller build failed, {target_dist_root} missing.")
        # Restore frontend just in case
        if os.path.exists(temp_frontend_dir):
            shutil.move(temp_frontend_dir, dist_dir)
        sys.exit(1)

    print(f"Copying frontend from {temp_frontend_dir} to {target_static_dir}...")
    shutil.copytree(temp_frontend_dir, target_static_dir)

    # 6. Cleanup
    print("\n--- Step 5: Cleanup ---")
    if os.path.exists(temp_frontend_dir):
        shutil.rmtree(temp_frontend_dir)

    print("\n========================================")
    print(f"Build Success! Output located at: {target_dist_root}")
    print("Run the executable: dist\\MIDI-Navigate\\MIDI-Navigate.exe")
    print("========================================")

if __name__ == "__main__":
    main()
