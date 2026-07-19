$body = @{
    email = "admin@omnia.local"
    password = "Admin123!"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "https://omnia-api.vercel.app/api/auth/login" -Method POST -ContentType "application/json" -Body $body
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Body: $($response.Content)"
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)"
    Write-Host "X-Vercel-Error: $($_.Exception.Response.Headers['X-Vercel-Error'])"
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    Write-Host "Body: $($reader.ReadToEnd())"
}
