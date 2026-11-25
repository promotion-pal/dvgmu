<#
.SYNOPSIS
  Общий начальный пароль для новых учёток, созданных sync (выключенных и
  без пароля): пароль + «сменить при следующем входе» + включить.

.DESCRIPTION
  Запускает администратор AD на контроллере домена (или машине с RSAT) под
  своей учёткой — наш сервер прав на запись в AD не получает.

  По умолчанию ТОЛЬКО ПОКАЗЫВАЕТ, кого затронет. Изменения — только с -Apply.

  Берёт лишь учётки, которые одновременно:
    - лежат в указанном OU (-SearchBase),
    - выключены,
    - ещё ни разу не получали пароль (pwdLastSet = 0).
  Включённые учётки и учётки с паролем не трогаются никогда.

  При первом входе AD FS не пустит с начальным паролем, и форма входа
  auth.fesmu.ru сама откроет «Смена пароля» — человек задаёт свой.

.EXAMPLE
  # 1. Посмотреть, кого затронет (ничего не меняет):
  .\Set-InitialPassword.ps1 -SearchBase "OU=Students,OU=Users,DC=dvgmu,DC=local"

  # 2. Применить к первым 10 (пароль спросит, на экран не выводится):
  .\Set-InitialPassword.ps1 -SearchBase "OU=Students,OU=Users,DC=dvgmu,DC=local" -MaxCount 10 -Apply
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $SearchBase,
    [ValidateRange(1, 500)] [int] $MaxCount = 50,
    [switch] $Apply,
    [string] $LogPath = ".\initial-password-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module ActiveDirectory

# Только выключенные и без пароля (pwdLastSet = 0) — ровно те, что создал sync.
$candidates = @(Get-ADUser -SearchBase $SearchBase -SearchScope Subtree `
    -LDAPFilter '(&(objectCategory=person)(objectClass=user)(userAccountControl:1.2.840.113556.1.4.803:=2)(pwdLastSet=0))' `
    -Properties pwdLastSet, Enabled, whenCreated |
    Where-Object { -not $_.Enabled -and $_.pwdLastSet -eq 0 } |
    Sort-Object whenCreated |
    Select-Object -First $MaxCount)

if ($candidates.Count -eq 0) {
    Write-Host "Подходящих учёток нет (выключенные и без пароля в $SearchBase)."
    return
}

Write-Host "Будут затронуты ($($candidates.Count), не больше $MaxCount):"
$candidates | Format-Table SamAccountName, Name, whenCreated -AutoSize

if (-not $Apply) {
    Write-Host "Пробный запуск: ничего не изменено. Для применения добавьте -Apply." -ForegroundColor Yellow
    return
}

$password = Read-Host "Общий начальный пароль" -AsSecureString
$confirm  = Read-Host "Повторите пароль" -AsSecureString
$plain1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))
$plain2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm))
if ($plain1 -ne $plain2) { throw "Пароли не совпадают — ничего не изменено." }
$plain1 = $null; $plain2 = $null

$answer = Read-Host "Применить к $($candidates.Count) учёткам? Введите ДА"
if ($answer -ne 'ДА') { Write-Host "Отменено — ничего не изменено."; return }

$log = foreach ($user in $candidates) {
    $row = [ordered]@{ SamAccountName = $user.SamAccountName; Name = $user.Name; Result = ''; Error = '' }
    try {
        # Порядок важен: сначала пароль (не прошёл политику — учётка остаётся
        # выключенной), потом «сменить при входе», потом включить.
        Set-ADAccountPassword -Identity $user -Reset -NewPassword $password
        Set-ADUser -Identity $user -ChangePasswordAtLogon $true
        Enable-ADAccount -Identity $user
        $row.Result = 'ok'
    } catch {
        $row.Result = 'error'
        $row.Error = $_.Exception.Message
        Write-Warning "$($user.SamAccountName): $($_.Exception.Message)"
    }
    [pscustomobject]$row
}

$log | Export-Csv -Path $LogPath -NoTypeInformation -Encoding UTF8
$ok = @($log | Where-Object Result -eq 'ok').Count
Write-Host "Готово: $ok из $($candidates.Count). Журнал: $LogPath"
