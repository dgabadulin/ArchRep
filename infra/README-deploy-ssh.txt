# Вход на сервер по SSH без пароля (для infra\deploy.bat)

Подставьте свои значения вместо плейсхолдеров:
  YOUR_USER          — пользователь Linux на целевом сервере
  YOUR_JUMP_HOST     — промежуточный хост / realm (если используется схема user@realm@target)
  YOUR_TARGET_HOST   — имя или DNS конечного сервера приложения

Строка для SSH в таком виде: YOUR_USER@YOUR_JUMP_HOST@YOUR_TARGET_HOST

## 1. Создать ключ на ПК

Запустите **cmd** (не PowerShell) и выполните:

```bat
mkdir "%USERPROFILE%\.ssh" 2>nul
ssh-keygen -t ed25519 -C "deploy-your-project" -f "%USERPROFILE%\.ssh\id_ed25519_isar" -N ""
```

Проверка — должны появиться два файла:

```bat
dir "%USERPROFILE%\.ssh\id_ed25519_isar*"
```

## 2. Скопировать публичный ключ на сервер

**Вариант А** — одной командой (если есть ssh-copy-id):

```bat
ssh-copy-id -i "%USERPROFILE%\.ssh\id_ed25519_isar.pub" YOUR_USER@YOUR_JUMP_HOST@YOUR_TARGET_HOST
```

Один раз введите пароль — ключ добавится в ~/.ssh/authorized_keys на сервере.

**Вариант Б** — вручную:

1. Показать ключ и скопировать строку в буфер:

   ```bat
   type "%USERPROFILE%\.ssh\id_ed25519_isar.pub"
   ```

2. Зайти на сервер по паролю:

   ```bat
   ssh YOUR_USER@YOUR_JUMP_HOST@YOUR_TARGET_HOST
   ```

3. На сервере выполнить (вставить скопированную строку вместо ВСТАВЬТЕ_СТРОКУ_КЛЮЧА):

   ```bash
   mkdir -p ~/.ssh
   chmod 700 ~/.ssh
   echo "ВСТАВЬТЕ_СТРОКУ_КЛЮЧА" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   exit
   ```

## 3. Проверить

В **cmd**:

```bat
ssh -i "%USERPROFILE%\.ssh\id_ed25519_isar" YOUR_USER@YOUR_JUMP_HOST@YOUR_TARGET_HOST "echo OK"
```

Должно вывести `OK` без запроса пароля. После этого deploy.bat тоже не будет спрашивать пароль (если заданы переменные DEPLOY_SSH_*).

---

Важно: команды с `%USERPROFILE%` выполняйте в **cmd**. В PowerShell используйте `$env:USERPROFILE`, либо запускайте deploy.bat через cmd.
