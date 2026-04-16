param(
    [string]$InputFile = "C:\Dev\study\python\DS_PBL\overseas_movie_test\data\analysis_ready\overseas_movies_general_only_2016_2025_analysis_ready.csv",
    [string]$OutputDir = "C:\Dev\study\python\DS_PBL\overseas_movie_test\outputs\visuals\assignment1"
)

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms.DataVisualization

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function To-NullableDouble {
    param($Value)
    if ([string]::IsNullOrWhiteSpace([string]$Value)) {
        return $null
    }
    return [double]$Value
}

function Get-CompactLabel {
    param([double]$Value)
    $absValue = [Math]::Abs($Value)
    if ($absValue -ge 1000000000) {
        return ("{0:N1}B" -f ($Value / 1000000000))
    }
    if ($absValue -ge 1000000) {
        return ("{0:N1}M" -f ($Value / 1000000))
    }
    if ($absValue -ge 1000) {
        return ("{0:N0}K" -f ($Value / 1000))
    }
    return ("{0:N0}" -f $Value)
}

function Get-Median {
    param([double[]]$Values)
    if ($Values.Count -eq 0) {
        return $null
    }
    $sorted = $Values | Sort-Object
    $middle = [int][Math]::Floor($sorted.Count / 2)
    if ($sorted.Count % 2 -eq 0) {
        return ($sorted[$middle - 1] + $sorted[$middle]) / 2
    }
    return $sorted[$middle]
}

function Get-HistogramRows {
    param(
        [double[]]$Values,
        [int]$BinCount = 12
    )

    if ($Values.Count -eq 0) {
        return @()
    }

    $minimum = ($Values | Measure-Object -Minimum).Minimum
    $maximum = ($Values | Measure-Object -Maximum).Maximum

    if ($minimum -eq $maximum) {
        return @([pscustomobject]@{
            Label = (Get-CompactLabel -Value $minimum)
            Count = $Values.Count
        })
    }

    $width = ($maximum - $minimum) / $BinCount
    $bins = @()

    for ($index = 0; $index -lt $BinCount; $index += 1) {
        $start = $minimum + ($width * $index)
        $end = if ($index -eq ($BinCount - 1)) { $maximum } else { $minimum + ($width * ($index + 1)) }
        $bins += [pscustomobject]@{
            Start = $start
            End = $end
            Count = 0
        }
    }

    foreach ($value in $Values) {
        if ($value -eq $maximum) {
            $targetIndex = $BinCount - 1
        }
        else {
            $targetIndex = [int][Math]::Floor(($value - $minimum) / $width)
            if ($targetIndex -lt 0) { $targetIndex = 0 }
            if ($targetIndex -ge $BinCount) { $targetIndex = $BinCount - 1 }
        }
        $bins[$targetIndex].Count += 1
    }

    return $bins | ForEach-Object {
        [pscustomobject]@{
            Label = ("{0}-{1}" -f (Get-CompactLabel -Value $_.Start), (Get-CompactLabel -Value $_.End))
            Count = $_.Count
        }
    }
}

function New-ChartObject {
    param(
        [string]$Title,
        [int]$Width = 1200,
        [int]$Height = 700
    )

    $chart = New-Object System.Windows.Forms.DataVisualization.Charting.Chart
    $chart.Width = $Width
    $chart.Height = $Height
    $chart.BackColor = [System.Drawing.Color]::White
    $chart.Palette = [System.Windows.Forms.DataVisualization.Charting.ChartColorPalette]::BrightPastel

    $area = New-Object System.Windows.Forms.DataVisualization.Charting.ChartArea "Main"
    $area.BackColor = [System.Drawing.Color]::WhiteSmoke
    $area.AxisX.MajorGrid.Enabled = $false
    $area.AxisY.MajorGrid.LineColor = [System.Drawing.Color]::LightGray
    $area.AxisX.Interval = 1
    $area.AxisX.LabelStyle.Font = New-Object System.Drawing.Font("Arial", 10)
    $area.AxisY.LabelStyle.Font = New-Object System.Drawing.Font("Arial", 10)
    $chart.ChartAreas.Add($area)

    $titleObject = New-Object System.Windows.Forms.DataVisualization.Charting.Title
    $titleObject.Text = $Title
    $titleObject.Font = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
    $chart.Titles.Add($titleObject)

    return $chart
}

function Save-ColumnChart {
    param(
        [object[]]$Rows,
        [string]$LabelField,
        [string]$ValueField,
        [string]$Title,
        [string]$OutputPath,
        [switch]$AngleLabels
    )

    $chart = New-ChartObject -Title $Title
    $series = New-Object System.Windows.Forms.DataVisualization.Charting.Series "Series"
    $series.ChartType = [System.Windows.Forms.DataVisualization.Charting.SeriesChartType]::Column
    $series.IsValueShownAsLabel = $true
    $series.Font = New-Object System.Drawing.Font("Arial", 8)

    foreach ($row in $Rows) {
        [void]$series.Points.AddXY([string]$row.$LabelField, [double]$row.$ValueField)
    }

    $chart.Series.Add($series)
    if ($AngleLabels) {
        $chart.ChartAreas["Main"].AxisX.LabelStyle.Angle = -45
    }
    $chart.SaveImage($OutputPath, [System.Windows.Forms.DataVisualization.Charting.ChartImageFormat]::Png)
    $chart.Dispose()
}

function Save-BarChart {
    param(
        [object[]]$Rows,
        [string]$LabelField,
        [string]$ValueField,
        [string]$Title,
        [string]$OutputPath
    )

    $chart = New-ChartObject -Title $Title
    $series = New-Object System.Windows.Forms.DataVisualization.Charting.Series "Series"
    $series.ChartType = [System.Windows.Forms.DataVisualization.Charting.SeriesChartType]::Bar
    $series.IsValueShownAsLabel = $true
    $series.Font = New-Object System.Drawing.Font("Arial", 8)

    foreach ($row in $Rows) {
        [void]$series.Points.AddXY([string]$row.$LabelField, [double]$row.$ValueField)
    }

    $chart.Series.Add($series)
    $chart.SaveImage($OutputPath, [System.Windows.Forms.DataVisualization.Charting.ChartImageFormat]::Png)
    $chart.Dispose()
}

Ensure-Directory -Path $OutputDir
$rows = Import-Csv -LiteralPath $InputFile

$selectedColumns = @(
    "movie_name",
    "imdb_title_id",
    "open_date",
    "genre",
    "rating",
    "distributor",
    "brand_name",
    "franchise_name",
    "director",
    "running_time",
    "budget_usd",
    "opening_theaters",
    "widest_release_theaters",
    "worldwide_gross_usd",
    "domestic_gross_usd",
    "opening_gross_usd"
)

$nullSummary = foreach ($column in $selectedColumns) {
    $missingCount = ($rows | Where-Object { [string]::IsNullOrWhiteSpace($_.$column) }).Count
    [pscustomobject]@{
        column = $column
        missing_count = $missingCount
        missing_pct = [Math]::Round(($missingCount / $rows.Count) * 100, 2)
    }
}
$nullSummary | Export-Csv -LiteralPath (Join-Path $OutputDir "null_summary.csv") -NoTypeInformation -Encoding UTF8

$numericFields = @(
    "worldwide_gross_usd",
    "domestic_gross_usd",
    "opening_gross_usd",
    "opening_theaters",
    "widest_release_theaters",
    "budget_usd"
)

$basicStatistics = foreach ($field in $numericFields) {
    $values = $rows |
        ForEach-Object { To-NullableDouble $_.$field } |
        Where-Object { $null -ne $_ }

    [pscustomobject]@{
        field = $field
        count = $values.Count
        mean = if ($values.Count -gt 0) { [Math]::Round((($values | Measure-Object -Average).Average), 2) } else { $null }
        median = if ($values.Count -gt 0) { [Math]::Round((Get-Median -Values $values), 2) } else { $null }
        min = if ($values.Count -gt 0) { ($values | Measure-Object -Minimum).Minimum } else { $null }
        max = if ($values.Count -gt 0) { ($values | Measure-Object -Maximum).Maximum } else { $null }
    }
}
$basicStatistics | Export-Csv -LiteralPath (Join-Path $OutputDir "basic_statistics.csv") -NoTypeInformation -Encoding UTF8

$uniqueDistributors = ($rows | Where-Object { -not [string]::IsNullOrWhiteSpace($_.distributor) } | Select-Object -ExpandProperty distributor -Unique).Count
$uniqueRatings = ($rows | Where-Object { -not [string]::IsNullOrWhiteSpace($_.rating) } | Select-Object -ExpandProperty rating -Unique).Count
$budgetCount = ($rows | Where-Object { -not [string]::IsNullOrWhiteSpace($_.budget_usd) }).Count
$overview = @(
    "dataset=overseas_movies_general_only_2016_2025_analysis_ready.csv"
    "row_count=$($rows.Count)"
    "year_range=2016-2025"
    "general_movie_only=true"
    "analysis_subject=distributor"
    "objective_1=Identify which genre and rating combinations are more favorable for distributors."
    "objective_2=Understand which release months and seasons are more favorable for distributor timing."
    "objective_3=Check how strongly theater expansion connects to box-office outcome."
    "objective_4=Compare pre, during, and post COVID periods to update distributor strategy."
    "unique_distributors=$uniqueDistributors"
    "unique_ratings=$uniqueRatings"
    "budget_available_count=$budgetCount"
    "notes=This file keeps general movies only and excludes obvious re-releases and event cinema. Theaters are not the same as KOBIS screen counts. Audience count and show count are unavailable."
)
$overview | Set-Content -LiteralPath (Join-Path $OutputDir "dataset_overview.txt") -Encoding UTF8

$worldwideValues = $rows | ForEach-Object { To-NullableDouble $_.worldwide_gross_usd } | Where-Object { $null -ne $_ }
$domesticValues = $rows | ForEach-Object { To-NullableDouble $_.domestic_gross_usd } | Where-Object { $null -ne $_ }
$widestValues = $rows | ForEach-Object { To-NullableDouble $_.widest_release_theaters } | Where-Object { $null -ne $_ }
$openingTheaterValues = $rows | ForEach-Object { To-NullableDouble $_.opening_theaters } | Where-Object { $null -ne $_ }

$nullChartRows = $nullSummary | Sort-Object -Property missing_count -Descending
Save-ColumnChart -Rows $nullChartRows -LabelField "column" -ValueField "missing_count" -Title "Null Counts by Column" -OutputPath (Join-Path $OutputDir "01_null_counts.png") -AngleLabels

$worldwideHistogram = Get-HistogramRows -Values $worldwideValues -BinCount 12
Save-ColumnChart -Rows $worldwideHistogram -LabelField "Label" -ValueField "Count" -Title "Worldwide Gross Distribution" -OutputPath (Join-Path $OutputDir "02_worldwide_gross_distribution.png") -AngleLabels

$domesticHistogram = Get-HistogramRows -Values $domesticValues -BinCount 12
Save-ColumnChart -Rows $domesticHistogram -LabelField "Label" -ValueField "Count" -Title "Domestic Gross Distribution" -OutputPath (Join-Path $OutputDir "03_domestic_gross_distribution.png") -AngleLabels

$widestHistogram = Get-HistogramRows -Values $widestValues -BinCount 12
Save-ColumnChart -Rows $widestHistogram -LabelField "Label" -ValueField "Count" -Title "Widest Release Theaters Distribution" -OutputPath (Join-Path $OutputDir "04_widest_release_theaters_distribution.png") -AngleLabels

$openingHistogram = Get-HistogramRows -Values $openingTheaterValues -BinCount 12
Save-ColumnChart -Rows $openingHistogram -LabelField "Label" -ValueField "Count" -Title "Opening Theaters Distribution" -OutputPath (Join-Path $OutputDir "05_opening_theaters_distribution.png") -AngleLabels

$ratingCounts = $rows |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_.rating) } |
    Group-Object -Property rating |
    Sort-Object -Property Count -Descending |
    ForEach-Object {
        [pscustomobject]@{
            rating = $_.Name
            movie_count = $_.Count
        }
    }
Save-ColumnChart -Rows $ratingCounts -LabelField "rating" -ValueField "movie_count" -Title "Rating Counts" -OutputPath (Join-Path $OutputDir "06_rating_counts.png")

$openYearCounts = $rows |
    Group-Object -Property chart_year |
    Sort-Object -Property Name |
    ForEach-Object {
        [pscustomobject]@{
            chart_year = $_.Name
            movie_count = $_.Count
        }
    }
Save-ColumnChart -Rows $openYearCounts -LabelField "chart_year" -ValueField "movie_count" -Title "Chart Year Counts" -OutputPath (Join-Path $OutputDir "07_open_year_counts.png")

$genreCounts = $rows |
    ForEach-Object {
        if (-not [string]::IsNullOrWhiteSpace($_.genre)) {
            foreach ($genre in ($_.genre -split "\|")) {
                $normalizedGenre = $genre.Trim()
                if (
                    -not [string]::IsNullOrWhiteSpace($normalizedGenre) -and
                    $normalizedGenre -notin @("IMAX", "3D IMAX", "News", "Short", "Talk-Show")
                ) {
                    [pscustomobject]@{ genre = $normalizedGenre }
                }
            }
        }
    } |
    Group-Object -Property genre |
    Sort-Object -Property Count -Descending |
    Select-Object -First 10 |
    ForEach-Object {
        [pscustomobject]@{
            genre = $_.Name
            movie_count = $_.Count
        }
    }
Save-BarChart -Rows $genreCounts -LabelField "genre" -ValueField "movie_count" -Title "Top 10 Genre Counts" -OutputPath (Join-Path $OutputDir "08_genre_top10_counts.png")

$distributorCounts = $rows |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_.distributor) } |
    Group-Object -Property distributor |
    Sort-Object -Property Count -Descending |
    Select-Object -First 10 |
    ForEach-Object {
        [pscustomobject]@{
            distributor = $_.Name
            movie_count = $_.Count
        }
    }
Save-BarChart -Rows $distributorCounts -LabelField "distributor" -ValueField "movie_count" -Title "Top 10 Distributor Counts" -OutputPath (Join-Path $OutputDir "09_distributor_top10_counts.png")

Write-Output "Saved assignment1 visuals to $OutputDir"
