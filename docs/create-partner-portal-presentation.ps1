# Генерация презентации: Партнёрский портал — портальное решение vs BPM
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$outputPath = Join-Path $PSScriptRoot "partner-portal-headless-cms-vs-bpm.pptx"

$ppLayoutTitle     = 1
$ppLayoutText      = 2
$ppLayoutBlank     = 12
$ppLayoutTitleOnly = 11
$ppAlignLeft       = 1
$msoFalse          = 0
$msoTrue           = -1

function Add-TitleSlide {
    param($Pres, [string]$Title, [string]$Subtitle)
    $slide = $Pres.Slides.Add(1, $ppLayoutTitle)
    $slide.Shapes[1].TextFrame.TextRange.Text = $Title
    $slide.Shapes[2].TextFrame.TextRange.Text = $Subtitle
}

function Add-BulletSlide {
    param($Pres, [string]$Title, [string[]]$Bullets, [int]$FontSize = 18)
    $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutText)
    $slide.Shapes[1].TextFrame.TextRange.Text = $Title
    $slide.Shapes[1].TextFrame.TextRange.Font.Size = 28
    $slide.Shapes[1].TextFrame.TextRange.Font.Bold = $msoTrue

    $tf = $slide.Shapes[2].TextFrame.TextRange
    $tf.Text = $Bullets[0]
    $tf.Font.Size = $FontSize
    for ($i = 1; $i -lt $Bullets.Count; $i++) {
        $null = $slide.Shapes[2].TextFrame.TextRange.InsertAfter("`r`n" + $Bullets[$i])
    }
    $slide.Shapes[2].TextFrame.TextRange.ParagraphFormat.Bullet.Type = 1
}

function Add-TwoColumnSlide {
    param($Pres, [string]$Title, [string[]]$LeftBullets, [string[]]$RightBullets, [string]$LeftHeader, [string]$RightHeader)
    $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutBlank)

    $titleBox = $slide.Shapes.AddTextbox($ppAlignLeft, 40, 20, 880, 50)
    $titleBox.TextFrame.TextRange.Text = $Title
    $titleBox.TextFrame.TextRange.Font.Size = 28
    $titleBox.TextFrame.TextRange.Font.Bold = $msoTrue

    $lh = $slide.Shapes.AddTextbox($ppAlignLeft, 40, 80, 420, 30)
    $lh.TextFrame.TextRange.Text = $LeftHeader
    $lh.TextFrame.TextRange.Font.Size = 20
    $lh.TextFrame.TextRange.Font.Bold = $msoTrue
    $lh.TextFrame.TextRange.Font.Color.RGB = 0x0070C0

    $lb = $slide.Shapes.AddTextbox($ppAlignLeft, 40, 115, 420, 380)
    $lb.TextFrame.TextRange.Text = $LeftBullets[0]
    $lb.TextFrame.TextRange.Font.Size = 16
    for ($i = 1; $i -lt $LeftBullets.Count; $i++) {
        $null = $lb.TextFrame.TextRange.InsertAfter("`r`n" + $LeftBullets[$i])
    }
    $lb.TextFrame.TextRange.ParagraphFormat.Bullet.Type = 1

    $rh = $slide.Shapes.AddTextbox($ppAlignLeft, 500, 80, 420, 30)
    $rh.TextFrame.TextRange.Text = $RightHeader
    $rh.TextFrame.TextRange.Font.Size = 20
    $rh.TextFrame.TextRange.Font.Bold = $msoTrue
    $rh.TextFrame.TextRange.Font.Color.RGB = 0xC00000

    $rb = $slide.Shapes.AddTextbox($ppAlignLeft, 500, 115, 420, 380)
    $rb.TextFrame.TextRange.Text = $RightBullets[0]
    $rb.TextFrame.TextRange.Font.Size = 16
    for ($i = 1; $i -lt $RightBullets.Count; $i++) {
        $null = $rb.TextFrame.TextRange.InsertAfter("`r`n" + $RightBullets[$i])
    }
    $rb.TextFrame.TextRange.ParagraphFormat.Bullet.Type = 1
}

function Add-TableSlide {
    param($Pres, [string]$Title, [string[]]$Headers, [object[]]$Rows)
    $slide = $Pres.Slides.Add($Pres.Slides.Count + 1, $ppLayoutTitleOnly)
    $slide.Shapes[1].TextFrame.TextRange.Text = $Title

    $cols = $Headers.Count
    $rowCount = $Rows.Count + 1
    $table = $slide.Shapes.AddTable($rowCount, $cols, 30, 90, 900, 400).Table

    for ($c = 0; $c -lt $cols; $c++) {
        $cell = $table.Cell(1, $c + 1)
        $cell.Shape.TextFrame.TextRange.Text = $Headers[$c]
        $cell.Shape.TextFrame.TextRange.Font.Bold = $msoTrue
        $cell.Shape.TextFrame.TextRange.Font.Size = 14
        $cell.Shape.Fill.ForeColor.RGB = 0xD9E2F3
    }

    for ($r = 0; $r -lt $Rows.Count; $r++) {
        $row = $Rows[$r]
        for ($c = 0; $c -lt $cols; $c++) {
            $cell = $table.Cell($r + 2, $c + 1)
            $cell.Shape.TextFrame.TextRange.Text = $row[$c]
            $cell.Shape.TextFrame.TextRange.Font.Size = 12
            if ($c -eq 1) { $cell.Shape.TextFrame.TextRange.Font.Color.RGB = 0x0070C0 }
            if ($c -eq 2) { $cell.Shape.TextFrame.TextRange.Font.Color.RGB = 0xC00000 }
        }
    }
}

$pp = New-Object -ComObject PowerPoint.Application
$pp.Visible = $msoTrue
$pres = $pp.Presentations.Add()

$dateStr = Get-Date -Format "dd.MM.yyyy"

Add-TitleSlide $pres `
    "Партнёрский портал: портальное решение (Headless CMS) vs BPM-платформа" `
    "Обоснование архитектурного выбора`n$dateStr"

Add-BulletSlide $pres "Контекст и постановка задачи" @(
    "Требуется единый партнёрский портал — точка входа для внешних партнёров компании"
    "Портал должен агрегировать интерфейсы ~10 разнородных корпоративных систем"
    "Системы разработаны независимо: разные стеки, жизненные циклы, команды-владельцы"
    "Партнёрам нужен единый UX: одна точка входа, единый дизайн, единая авторизация"
    "Задача — не автоматизация процессов, а интеграция и представление существующих приложений"
)

Add-BulletSlide $pres "Ключевые функциональные требования" @(
    "Агрегация UI 10+ систем: microfrontend, iframe, открытие в соседнем окне"
    "Единый вход (SSO): SAML 2.0 / OpenID Connect, единая сессия, logout everywhere"
    "Унификация UI: общая оболочка (shell), навигация, дизайн-система, адаптивность"
    "Ролевая модель: маппинг ролей партнёра на доступные разделы и системы"
    "Управление контентом: новости, документы, FAQ, онбординг партнёров"
    "Персонализация: дашборд, избранное, контекст организации партнёра"
    "Аудит и безопасность: логирование доступа, CSP, sandbox для iframe"
) 16

Add-BulletSlide $pres "Портальное решение (Headless CMS / DXP)" @(
    "Специализированная платформа для цифровых витрин и агрегирующих порталов"
    "Headless CMS: контент и навигация через API, фронтенд — на выбор (React, Vue, Angular)"
    "Встроенные возможности: SSO-интеграция, RBAC, мультитенантность, CDN, i18n"
    "Паттерн Portal Shell: единая оболочка с точками монтирования для внешних UI"
    "Composable architecture: Module Federation, web components, iframe gateway"
    "Примеры: Liferay, Sitecore, Contentful + custom shell, Backbase, Bloomreach"
    "Назначение: агрегация, представление, персонализация — не исполнение бизнес-процессов"
)

Add-BulletSlide $pres "BPM-платформа — назначение и фокус" @(
    "BPM (Business Process Management) — автоматизация и оркестрация бизнес-процессов"
    "Ядро: моделирование процессов (BPMN), маршрутизация задач, SLA, эскалации"
    "UI в BPM — формы задач (human tasks), генерируемые из процессных моделей"
    "Интеграция с внешними системами — через адаптеры в контексте процесса"
    "Примеры: Camunda, Appian, Pega, ELMA365, Bizagi"
    "Сильные стороны: workflow, согласования, state machine, мониторинг процессов"
    "Слабые стороны для портала: агрегация чужих UI, единый UX, контент-менеджмент"
)

$compareRows = @(
    ,@("Агрегация UI 10 систем", "[+] Нативная задача", "[-] Не предусмотрено")
    ,@("Microfrontend / iframe", "[+] Shell + gateway", "[-] Только свои формы")
    ,@("SSO / Federation", "[+] IdP, OIDC, SAML", "[~] Ограниченно")
    ,@("Единый UI / Design System", "[+] Shell, темизация", "[-] Свой UI-фреймворк")
    ,@("Ролевая модель портала", "[+] RBAC, ABAC", "[~] Роли в процессах")
    ,@("Контент (новости, FAQ)", "[+] CMS из коробки", "[-] Нет")
    ,@("Персонализация", "[+] Дашборды, виджеты", "[~] В рамках задач")
    ,@("Автоматизация процессов", "[~] Через интеграцию", "[+] Ядро платформы")
    ,@("TCO для UI-агрегации", "Низкий", "Высокий (переделка)")
    ,@("Time-to-market", "2-4 мес.", "6-12+ мес.")
)
Add-TableSlide $pres "Сравнение по ключевым критериям" @("Критерий", "Портал (Headless CMS)", "BPM-платформа") $compareRows

Add-TwoColumnSlide $pres "Разная природа задач" `
    @(
        "Агрегировать готовые UI"
        "Обеспечить единую точку входа"
        "Унифицировать навигацию и дизайн"
        "Управлять контентом и персонализацией"
        "Делегировать бизнес-логику системам-источникам"
        "Масштабировать добавление новых систем"
    ) `
    @(
        "Моделировать и исполнять процессы"
        "Маршрутизировать задачи между ролями"
        "Управлять состоянием процесса"
        "Генерировать формы из BPMN-моделей"
        "Интегрировать системы в контексте шага процесса"
        "Мониторить SLA и эскалации"
    ) `
    "Партнёрский портал" `
    "BPM-платформа"

Add-BulletSlide $pres "Почему портальное решение — правильный выбор" @(
    "Прямое соответствие задаче: портал создан для агрегации разнородных приложений"
    "Гибкость встраивания: microfrontend (Module Federation), iframe с postMessage, deep links"
    "Headless-подход: контент и навигация через API — фронтенд не привязан к CMS"
    "SSO из коробки: интеграция с корпоративным IdP, propagation токенов к вложенным системам"
    "Единая оболочка (Portal Shell): header, sidebar, breadcrumbs, notifications"
    "Ролевая модель портала независима от ролей в системах-источниках"
    "Добавление 11-й системы — конфигурация, а не переделка процессной модели"
) 16

Add-BulletSlide $pres "Почему BPM-платформа — неподходящий выбор" @(
    "BPM не предназначена для агрегации чужих UI — придётся строить обходные решения"
    "Встраивание iframe/microfrontend в BPM-формы — хак, не штатная возможность"
    "UI BPM-платформ однотипен и плохо кастомизируется под корпоративный дизайн"
    "Контент-менеджмент (новости, документы) — отсутствует или примитивен"
    "SSO в BPM ориентирован на внутренних пользователей, не на внешних партнёров"
    "Попытка натянуть портал на BPM = разработка портала ВНУТРИ BPM с нуля"
    "Vendor lock-in: процессы, формы, интеграции — всё в одной платформе"
    "TCO и сроки: в 2-3 раза выше при худшем результате для задачи агрегации UI"
) 15

Add-BulletSlide $pres "Целевая архитектура партнёрского портала" @(
    "Portal Shell (React/Vue) — единая оболочка с дизайн-системой"
    "Headless CMS — контент, навигация, конфигурация виджетов и разделов (API)"
    "Identity Provider (Keycloak / ADFS) — SSO, federation, роли партнёров"
    "API Gateway — единая точка для BFF-запросов к backend-системам"
    "Integration Layer — microfrontend registry, iframe proxy, deep link router"
    "10 систем-источников — остаются автономными, портал только отображает их UI"
    "BPM (если нужен) — подключается как одна из систем, а не как платформа портала"
) 15

$integrationRows = @(
    ,@("Microfrontend", "Система на JS, готова к Federation", "Нативный UX, общий shell", "Требует доработки системы")
    ,@("iframe", "Legacy, нет доступа к коду", "Изоляция, быстрый старт", "Ограничения UX, CSP")
    ,@("Соседнее окно", "Тяжёлые/полноэкранные приложения", "Полная автономность UI", "Разрыв UX, popup-blockers")
    ,@("Deep link + SSO", "Система с собственным UI", "Минимальная интеграция", "Нет единой оболочки")
)
Add-TableSlide $pres "Способы интеграции UI систем в портал" @("Способ", "Когда использовать", "Плюсы", "Минусы") $integrationRows

Add-BulletSlide $pres "SSO и ролевая модель" @(
    "Единый IdP (Keycloak / Azure AD B2C) — аутентификация партнёров"
    "Протоколы: OpenID Connect для портала, SAML для legacy-систем"
    "Token propagation: портал передаёт токен в iframe/microfrontend через postMessage"
    "Роли портала (Partner Admin, Manager, Viewer) — маппятся на доступные разделы"
    "Роли в системах-источниках — остаются у владельцев систем, синхронизация через SCIM/claims"
    "Принцип least privilege: партнёр видит только свои системы и данные"
    "BPM-роли (исполнитель, согласующий) — не заменяют роли портала"
) 15

Add-BulletSlide $pres "Риски выбора BPM вместо портала" @(
    "Архитектурный тупик: BPM станет бутылочным горлышком для всех UI-интеграций"
    "Раздувание scope: команда начнёт строить CMS, SSO gateway, shell — всё с нуля"
    "Конфликт команд: BPM-владельцы vs команды систем-источников"
    "Производительность: лишний слой оркестрации для простого отображения UI"
    "Масштабирование: каждая новая система = новый процесс/формы в BPM"
    "Зависимость от вендора BPM для задач, которые не являются процессными"
) 16

Add-BulletSlide $pres "Рекомендации" @(
    "Использовать портальное решение (Headless CMS + Portal Shell) как основу"
    "BPM подключать точечно — только там, где реально нужна автоматизация процессов"
    "Начать с MVP: shell + SSO + 2-3 системы (iframe + один microfrontend)"
    "Определить дизайн-систему до интеграции систем"
    "Зафиксировать контракт интеграции: SSO claims, роли, API gateway"
    "Не смешивать роли портала и процессные роли BPM"
    "Оценить: Liferay, custom (Next.js + Strapi/Contentful), Backbase — по TCO"
) 16

Add-BulletSlide $pres "Заключение" @(
    "Партнёрский портал — задача агрегации и представления, а не оркестрации процессов"
    "Портальное решение (Headless CMS) создано именно для таких сценариев"
    "BPM решает другую задачу; использование BPM как портала — архитектурный антипаттерн"
    "Правильная архитектура: Portal Shell + Headless CMS + IdP + автономные системы"
    "BPM — опциональный компонент экосистемы, не платформа портала"
) 18

if (Test-Path $outputPath) { Remove-Item $outputPath -Force }
$pres.SaveAs($outputPath)
$pres.Close()
$pp.Quit()

[System.Runtime.Interopservices.Marshal]::ReleaseComObject($pres) | Out-Null
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($pp) | Out-Null
[GC]::Collect()

Write-Host "Done: $outputPath"
