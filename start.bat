@echo off
setlocal

set "REPO_ROOT=%~dp0"
set "CONDA_ENV=%REPO_ROOT%.panel-env"

if /I "%~1"=="backend" goto :backend
if /I "%~1"=="frontend" goto :frontend

goto :start

:backend
call conda activate "%CONDA_ENV%"
if errorlevel 1 (
    echo [ERROR] Failed to activate Conda environment: %CONDA_ENV%
    pause
    exit /b 1
)
cd /d "%REPO_ROOT%backend"
python main.py
pause
exit /b

:frontend
cd /d "%REPO_ROOT%"
call npm run dev
pause
exit /b

:start
where conda >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Conda was not found on PATH.
    echo Run this script from an Anaconda Prompt, or add Conda to PATH.
    pause
    exit /b 1
)

if not exist "%CONDA_ENV%\conda-meta\" (
    if exist "%CONDA_ENV%\" (
        echo [ERROR] Existing .panel-env is not a valid Conda environment.
        echo Remove or rename "%CONDA_ENV%", then run this script again.
        pause
        exit /b 1
    )

    echo Creating local Conda environment...
    call conda create --yes --prefix "%CONDA_ENV%" python=3.13 pip
    if errorlevel 1 (
        echo [ERROR] Failed to create the Conda environment.
        pause
        exit /b 1
    )

    echo Installing backend dependencies...
    call conda run --prefix "%CONDA_ENV%" python -m pip install --upgrade pip
    if errorlevel 1 (
        echo [ERROR] Failed to upgrade pip in .panel-env.
        pause
        exit /b 1
    )

    call conda run --prefix "%CONDA_ENV%" python -m pip install -r "%REPO_ROOT%requirements.txt"
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies.
        pause
        exit /b 1
    )
)

call conda activate "%CONDA_ENV%"
if errorlevel 1 (
    echo [ERROR] Failed to activate Conda environment: %CONDA_ENV%
    pause
    exit /b 1
)

python -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 13) else 1)"
if errorlevel 1 (
    echo [ERROR] .panel-env must use Python 3.13.
    echo Remove "%CONDA_ENV%", then run this script again.
    pause
    exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python is unavailable after activating .panel-env.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js 18+ is required but was not found on PATH.
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 18 (
    echo [ERROR] Node.js 18+ is required. Detected Node.js %NODE_MAJOR%.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm is unavailable. Install Node.js 18+ and try again.
    pause
    exit /b 1
)

if not exist "%REPO_ROOT%node_modules\" (
    echo Installing frontend dependencies...
    cd /d "%REPO_ROOT%"
    call npm ci
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        pause
        exit /b 1
    )
)

echo Starting MIDI-Navigate development services...
echo Frontend: http://127.0.0.1:5173/frontend/index.html
echo Backend:  http://127.0.0.1:8080
echo.
echo Close either server window to stop that service.

start "MIDI-Navigate Backend" /d "%REPO_ROOT%backend" cmd.exe /k ""%~f0" backend"
start "MIDI-Navigate Frontend" /d "%REPO_ROOT%" cmd.exe /k ""%~f0" frontend"

endlocal
exit /b
