// 1. Объявляем глобальные переменные для хранения данных и графиков
let countriesData = [];
let visitsChart = null;
let revenueChart = null;
let worldMap = null;
let countrySortOrder = 'asc';

$(document).ready(function () {
    // 2. Инициализация дат
    initDateFilters();
    
    // 3. Загрузка данных после полной готовности DOM
    fetchData();
    
    // 4. Настройка обработчиков событий
    $('#filters-form').on('submit', function (e) {
        e.preventDefault();
        fetchData();
    });

    $('#country-sort-header').on('click', function () {
        countrySortOrder = countrySortOrder === 'asc' ? 'desc' : 'asc';
        updateTable();
        updateCountrySortIcon();
    });

    updateCountrySortIcon();

    $('#export-csv').on('click', exportToCSV);
});

$(document).on('click', '.country-row', function () {
    const rowId = $(this).data('rowid');
    $(`#${rowId}`).toggle();
});

function initDateFilters() {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 7);
    
    $('#start-date').val(weekAgo.toISOString().split('T')[0]);
    $('#end-date').val(today.toISOString().split('T')[0]);
}

async function fetchData() {
    const startDate = $('#start-date').val();
    const endDate = $('#end-date').val();
    const language = $('#language').val();

    try {
        // 5. Показываем индикатор загрузки
        $('#loading-indicator').show();
        
        const response = await fetch(`https://addsapi.onrender.com/api/Analytics/countries/metadata?startDate=${startDate}&endDate=${endDate}&language=${language}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Полученные данные:", data);
        
        // 6. Преобразуем структуру данных
        countriesData = Object.values(data).flat();
        
        // 7. Обновляем интерфейс
        updateUI();
    } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        alert('Не удалось загрузить данные. Пожалуйста, попробуйте позже.');
    } finally {
        // 8. Скрываем индикатор загрузки
        $('#loading-indicator').hide();
    }
}

function updateUI() {
    if (!countriesData || countriesData.length === 0) {
        console.warn('Нет данных для отображения');
        $('#no-data-message').show();
        return;
    }
    
    $('#no-data-message').hide();
    
    try {
        // 9. Обновляем все компоненты по порядку
        updateSummaryMetrics();
        updateTable();
        initCharts();
        initMap();
    } catch (e) {
        console.error('Ошибка при обновлении интерфейса:', e);
    }
}

function updateSummaryMetrics() {
    // 10. Добавляем проверку на существование элементов
    if (!$('#total-visits').length) return;
    
    const metrics = {
        visits: countriesData.reduce((sum, c) => sum + (c.nb_visits || 0), 0),
        visitors: countriesData.reduce((sum, c) => sum + (c.nb_uniq_visitors || 0), 0),
        conversions: countriesData.reduce((sum, c) => sum + (c.nb_conversions || 0), 0),
        revenue: countriesData.reduce((sum, c) => sum + (c.revenue || 0), 0)
    };
    
    $('#total-visits').text(metrics.visits.toLocaleString());
    $('#total-visitors').text(metrics.visitors.toLocaleString());
    $('#total-conversions').text(metrics.conversions.toLocaleString());
    $('#total-revenue').text(`$${metrics.revenue.toFixed(2)}`);
}

function updateCountrySortIcon() {
    const icon = countrySortOrder === 'asc' ? '▲' : '▼';
    $('#country-sort-icon').text(icon);
}

function updateTable() {
    const $tableBody = $('#countries-data');
    if (!$tableBody.length) return;

    $tableBody.empty();

    // 1. Группируем данные по стране
    const countryGroups = {};
    countriesData.forEach(item => {
        const code = item.code;
        if (!countryGroups[code]) countryGroups[code] = [];
        countryGroups[code].push(item);
    });

    // 2. Формируем агрегированные строки
    let rows = Object.values(countryGroups)
        .map(group => aggregateCountryData(group));

    // 3. Сортировка по названию страны
    rows.sort((a, b) => {
        const labelA = (a.label || '').toLowerCase();
        const labelB = (b.label || '').toLowerCase();
        if (labelA < labelB) return countrySortOrder === 'asc' ? -1 : 1;
        if (labelA > labelB) return countrySortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. Выводим строки
    rows.forEach(aggCountry => {
        const row = createTableRow(aggCountry, countryGroups[aggCountry.code]);
        $tableBody.append(row);
    });
}


// Агрегируем данные по стране
function aggregateCountryData(group) {
    const first = group[0];
    const sum = (key) => group.reduce((acc, c) => acc + toNumber(c[key]), 0);
    return {
        code: first.code,
        label: first.label,
        nb_visits: sum('nb_visits'),
        nb_uniq_visitors: sum('nb_uniq_visitors'),
        nb_actions: sum('nb_actions'),
        nb_conversions: sum('nb_conversions'),
        nb_visits_converted: sum('nb_visits_converted'),
        sum_visit_length: sum('sum_visit_length'),
        bounce_count: sum('bounce_count'),
        revenue: sum('revenue')
    };
}

function toNumber(val) {
    // Преобразует к числу, если не число — возвращает 0
    const n = Number(val);
    return isFinite(n) ? n : 0;
}

function createTableRow(country, group) {
    const visits = toNumber(country.nb_visits);
    const uniq = toNumber(country.nb_uniq_visitors);
    const actions = toNumber(country.nb_actions);
    const conversions = toNumber(country.nb_conversions);
    const visitsConverted = toNumber(country.nb_visits_converted);
    const sumVisitLength = toNumber(country.sum_visit_length);
    const bounceCount = toNumber(country.bounce_count);
    const revenue = toNumber(country.revenue);

    const duration = visits > 0 ? sumVisitLength / visits : 0;
    const bounceRate = visits > 0 ? (bounceCount / visits) * 100 : 0;
    const conversionRate = visits > 0 ? (visitsConverted / visits) * 100 : 0;

    const rowId = `details-${country.code}`;

    let html = `
        <tr class="country-row" data-rowid="${rowId}" style="cursor:pointer;">
            <td><span class="flag-icon flag-icon-${country.code ? country.code.toLowerCase() : ''}"></span> ${country.label || '-'}</td>
            <td>${visits.toLocaleString()}</td>
            <td>${uniq.toLocaleString()}</td>
            <td>${actions.toLocaleString()}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1" style="height: 20px;">
                        <div class="progress-bar bg-success" style="width: ${Math.min(conversionRate, 100)}%"></div>
                    </div>
                    <span class="ms-2">${isFinite(conversionRate) ? conversionRate.toFixed(1) : '0.0'}%</span>
                </div>
            </td>
            <td>$${revenue.toFixed(2)}</td>
            <td>${formatDuration(duration)}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1" style="height: 20px;">
                        <div class="progress-bar bg-danger" style="width: ${Math.min(bounceRate, 100)}%"></div>
                    </div>
                    <span class="ms-2">${isFinite(bounceRate) ? bounceRate.toFixed(1) : '0.0'}%</span>
                </div>
            </td>
        </tr>
    `;

    // Детализация по дням (если есть больше одной записи)
    if (group && group.length > 1) {
        html += `
        <tr class="details-row" id="${rowId}" style="display:none;">
            <td colspan="9">
                <table class="table table-sm table-bordered mb-0">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Визиты</th>
                            <th>Уникальные посетители</th>
                            <th>Действия</th>
                            <th>Конверсии</th>
                            <th>Доход</th>
                            <th>Длительность</th>
                            <th>Отказы</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${group.map(item => {
                            const v = toNumber(item.nb_visits);
                            const dur = v > 0 ? toNumber(item.sum_visit_length) / v : 0;
                            const br = v > 0 ? (toNumber(item.bounce_count) / v) * 100 : 0;
                            return `
                            <tr>
                                <td>${item.date || '-'}</td>
                                <td>${v.toLocaleString()}</td>
                                <td>${toNumber(item.nb_uniq_visitors).toLocaleString()}</td>
                                <td>${toNumber(item.nb_actions).toLocaleString()}</td>
                                <td>${toNumber(item.nb_conversions).toLocaleString()}</td>
                                <td>$${toNumber(item.revenue).toFixed(2)}</td>
                                <td>${formatDuration(dur)}</td>
                                <td>${isFinite(br) ? br.toFixed(1) : '0.0'}%</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </td>
        </tr>
        `;
    }

    return html;
}


function initCharts() {
    // 13. Проверяем наличие canvas-элементов
    const visitsCanvas = document.getElementById('visits-chart');
    const revenueCanvas = document.getElementById('revenue-chart');
    
    if (!visitsCanvas || !revenueCanvas) {
        console.error('Canvas elements not found');
        return;
    }
    
    // Очищаем предыдущие графики
    if (visitsChart) visitsChart.destroy();
    if (revenueChart) revenueChart.destroy();
    
    // Создаем новые графики
    visitsChart = createVisitsChart(visitsCanvas);
    revenueChart = createRevenueChart(revenueCanvas);
}

function createVisitsChart(canvas) {
    // Агрегация данных по странам
    const countryAggregates = {};
    countriesData.forEach(country => {
        const countryCode = country.code.toUpperCase();
        if (!countryAggregates[countryCode]) {
            countryAggregates[countryCode] = {
                label: country.label,
                nb_visits: 0,
                nb_uniq_visitors: 0,
                revenue: 0 // Добавляем доход для агрегации
            };
        }
        countryAggregates[countryCode].nb_visits += country.nb_visits || 0;
        countryAggregates[countryCode].nb_uniq_visitors += country.nb_uniq_visitors || 0;
        countryAggregates[countryCode].revenue += country.revenue || 0;
    });

    // Преобразуем объект в массив и сортируем по визитам
    const topCountries = Object.values(countryAggregates)
        .sort((a, b) => (b.nb_visits || 0) - (a.nb_visits || 0))
        .slice(0, 10);

    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: topCountries.map(c => c.label),
            datasets: [
                {
                    label: 'Визиты',
                    data: topCountries.map(c => c.nb_visits || 0),
                    backgroundColor: 'rgba(54, 162, 235, 0.7)'
                },
                {
                    label: 'Уникальные посетители',
                    data: topCountries.map(c => c.nb_uniq_visitors || 0),
                    backgroundColor: 'rgba(75, 192, 192, 0.7)'
                }
            ]
        },
        options: getChartOptions('Количество')
    });
}

function createRevenueChart(canvas) {
    // Агрегация данных по странам
    const countryAggregates = {};
    countriesData.forEach(country => {
        const countryCode = country.code.toUpperCase();
        if (!countryAggregates[countryCode]) {
            countryAggregates[countryCode] = {
                label: country.label,
                revenue: 0
            };
        }
        countryAggregates[countryCode].revenue += country.revenue || 0;
    });

    // Преобразуем объект в массив и сортируем по доходу
    const topCountries = Object.values(countryAggregates)
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, 10);

    return new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: topCountries.map(c => c.label),
            datasets: [{
                label: 'Доход',
                data: topCountries.map(c => c.revenue || 0),
                backgroundColor: 'rgba(153, 102, 255, 0.7)'
            }]
        },
        options: getChartOptions('Доход ($)', true)
    });
}

function getChartOptions(title, isCurrency = false) {
    return {
        responsive: true,
        plugins: {
            legend: { position: 'top' },
            tooltip: {
                callbacks: {
                    label: ctx => {
                        const value = isCurrency 
                            ? `$${ctx.raw.toFixed(2)}` 
                            : ctx.raw.toLocaleString();
                        return `${ctx.dataset.label}: ${value}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: value => isCurrency 
                        ? `$${value.toLocaleString()}` 
                        : value.toLocaleString()
                }
            }
        }
    };
}

function initMap() {
    const mapContainer = document.getElementById('world-map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Очищаем контейнер
    mapContainer.innerHTML = '';

    // Проверяем наличие Datamap
    if (typeof Datamap === 'undefined') {
        console.error('Datamaps library not loaded');
        return;
    }

    // Создаем данные для карты
    const mapData = {};
    countriesData.forEach(country => {
        if (country.code) {
            mapData[country.code.toUpperCase()] = {
                visits: country.nb_visits || 0,
                revenue: country.revenue || 0,
                fillKey: getFillKey(country.nb_visits || 0)
            };
        }
    });

    try {
        // Инициализируем новую карту
        worldMap = new Datamap({
            element: mapContainer,
            scope: 'world',
            projection: 'mercator',
            fills: {
                HIGH: '#006837',
                MEDIUM: '#31a354',
                LOW: '#78c679',
                VERY_LOW: '#c2e699',
                NONE: '#ffffcc'
            },
            data: mapData,
            geographyConfig: {
                popupOnHover: true,
                highlightOnHover: true,
                popupTemplate: function(geo, data) {
                    if (!data) return null;
                    return [
                        '<div class="hoverinfo">',
                        '<strong>' + geo.properties.name + '</strong>',
                        '<br/>Visits: ' + data.visits.toLocaleString(),
                        '<br/>Revenue: $' + data.revenue.toFixed(2),
                        '</div>'
                    ].join('');
                }
            },
            done: function(datamap) {
                datamap.svg.selectAll('.datamaps-subunit').on('mouseover', function(geography) {
                    // Добавляем обработчики событий
                });
            }
        });
    } catch (e) {
        console.error('Error initializing map:', e);
        // Fallback: показать простое сообщение
        mapContainer.innerHTML = '<div class="alert alert-warning">Could not load world map</div>';
    }
}

function getFillKey(visits) {
    if (visits > 1000) return 'HIGH';
    if (visits > 500) return 'MEDIUM';
    if (visits > 100) return 'LOW';
    if (visits > 0) return 'VERY_LOW';
    return 'NONE';
}

function formatDuration(seconds) {
    seconds = parseInt(seconds) || 0;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return [hrs, mins, secs].map(v => v.toString().padStart(2, '0')).join(':');
}

// Export data to CSV
function exportToCSV() {
    const headers = [
        'Country',
        'Visits',
        'Unique Visitors',
        'Actions',
        'Conversions',
        'Conversion Rate',
        'Revenue',
        'Avg. Visit Duration',
        'Bounce Rate'
    ];

    const rows = countriesData.map(country => {
        const avgVisitDuration = country.sum_visit_length / country.nb_visits;
        const bounceRate = (country.bounce_count / country.nb_visits) * 100;
        const conversionRate = (country.nb_visits_converted / country.nb_visits) * 100;

        return [
            `"${country.label}"`,
            country.nb_visits,
            country.nb_uniq_visitors,
            country.nb_actions,
            country.nb_conversions,
            conversionRate.toFixed(2),
            (country.revenue || 0).toFixed(2),
            formatDuration(avgVisitDuration),
            bounceRate.toFixed(2)
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'countries_analytics.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}