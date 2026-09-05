param(
  [string]$SourceDirectory = 'C:\Code2\synth-engine\engine-stable',
  [string]$BuildDirectory = 'C:\Code2\synth-engine\build-canino',
  [int]$Jobs = 8
)

$resolvedSource = [System.IO.Path]::GetFullPath($SourceDirectory)
$resolvedBuild = [System.IO.Path]::GetFullPath($BuildDirectory)

if (-not (Test-Path -LiteralPath (Join-Path $resolvedSource 'CMakeLists.txt'))) {
  throw "Fonte do Pulse não encontrada em $resolvedSource"
}

New-Item -ItemType Directory -Path $resolvedBuild -Force | Out-Null

$toolchainImage = 'open-vetsim/pulse-canine-toolchain:bookworm'
$toolchainDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\native\pulse-canined'))
docker image inspect $toolchainImage *> $null
if ($LASTEXITCODE -ne 0) {
  docker build -t $toolchainImage -f (Join-Path $toolchainDirectory 'Dockerfile.toolchain') $toolchainDirectory
  if ($LASTEXITCODE -ne 0) {
    throw 'Não foi possível construir a imagem do toolchain Pulse.'
  }
}

docker run --rm `
  -v "${resolvedSource}:/source" `
  -v "${resolvedBuild}:/build" `
  $toolchainImage `
  sh -lc "cmake -S /source -B /build -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/build/install -DPulse_JAVA_API=OFF -DPulse_PYTHON_API=OFF -DPulse_GEN_DATA=OFF -DPulse_DOWNLOAD_BASELINES=OFF && cmake --build /build -j$Jobs && cmake --build /build/Innerbuild --target PulseCanineWorker -j$Jobs && cmake -E copy_if_different /build/Innerbuild/src/cpp/canine_worker/PulseCanineWorker /build/install/bin/PulseCanineWorker"

if ($LASTEXITCODE -ne 0) {
  throw 'A compilação do Pulse canino falhou.'
}

$runtimeImage = 'open-vetsim/pulse-canine-runtime:4.3.1-data-bookworm'
docker image inspect $runtimeImage *> $null
if ($LASTEXITCODE -ne 0) {
  docker build -t $runtimeImage -f (Join-Path $toolchainDirectory 'Dockerfile.runtime') $toolchainDirectory
  if ($LASTEXITCODE -ne 0) {
    throw 'Não foi possível construir a imagem de execução do Pulse canino.'
  }
}

Write-Host "Pulse canino compilado em $resolvedBuild\install\bin"
