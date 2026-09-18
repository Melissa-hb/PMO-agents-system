# Carga backend/.env en variables de entorno y arranca el backend con Maven.
# Uso: powershell -ExecutionPolicy Bypass -File .\run-local.ps1

# El pom.xml usa java.version=21. Si el JAVA_HOME activo es mas nuevo (ej. JDK 25), Lombok
# puede fallar en silencio (no genera getters/setters/builders) y la compilacion truena con
# cientos de "cannot find symbol". Forzamos JDK 21 aqui si esta instalado.
$jdk21 = "C:\Program Files\Java\jdk-21"
if (Test-Path $jdk21) {
    $env:JAVA_HOME = $jdk21
    $env:Path = "$jdk21\bin;$env:Path"
}

$envFile = Join-Path $PSScriptRoot ".env"
if (-not (Test-Path $envFile)) {
    Write-Error "No existe $envFile. Copia .env.example a .env y completa los valores."
    exit 1
}

Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
        $name = $matches[1].Trim()
        $value = $matches[2].Trim()
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
    }
}

$mvnCmd = Get-Command mvn -ErrorAction SilentlyContinue
if ($mvnCmd) {
    mvn spring-boot:run
} else {
    $fallback = "C:\Users\USUARIO\.m2\wrapper\dists\apache-maven-3.9.11\a2d47e15\bin\mvn.cmd"
    if (-not (Test-Path $fallback)) {
        Write-Error "No se encontro 'mvn' en el PATH ni en $fallback. Instala Maven o ajusta esta ruta."
        exit 1
    }
    & $fallback spring-boot:run
}
