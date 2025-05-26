// 1. Объявляем глобальные переменные для хранения данных и графиков
let countriesData = [];
let visitsChart = null;
let revenueChart = null;
let worldMap = null;

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

    $('#export-csv').on('click', exportToCSV);
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
        
        const response = await fetch(`https://localhost:7001/api/Analytics/countries/metadata?startDate=${startDate}&endDate=${endDate}&language=${language}`);
        
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

function updateTable() {
    const $tableBody = $('#countries-data');
    if (!$tableBody.length) return;
    
    $tableBody.empty();
    
    // 11. Сортируем и выводим данные
    countriesData
        .sort((a, b) => (b.nb_visits || 0) - (a.nb_visits || 0))
        .forEach(country => {
            const row = createTableRow(country);
            $tableBody.append(row);
        });
}

function createTableRow(country) {
    // 12. Рассчитываем метрики для строки
    const visits = country.nb_visits || 0;
    const duration = visits ? (country.sum_visit_length || 0) / visits : 0;
    const bounceRate = visits ? ((country.bounce_count || 0) / visits) * 100 : 0;
    const conversionRate = visits ? ((country.nb_visits_converted || 0) / visits) * 100 : 0;
    
    return `
        <tr>
            <td><span class="flag-icon flag-icon-${country.code.toLowerCase()}"></span> ${country.label}</td>
            <td>${visits.toLocaleString()}</td>
            <td>${(country.nb_uniq_visitors || 0).toLocaleString()}</td>
            <td>${(country.nb_actions || 0).toLocaleString()}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1" style="height: 20px;">
                        <div class="progress-bar bg-success" style="width: ${conversionRate}%"></div>
                    </div>
                    <span class="ms-2">${conversionRate.toFixed(1)}%</span>
                </div>
            </td>
            <td>$${(country.revenue || 0).toFixed(2)}</td>
            <td>${formatDuration(duration)}</td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="progress flex-grow-1" style="height: 20px;">
                        <div class="progress-bar bg-danger" style="width: ${bounceRate}%"></div>
                    </div>
                    <span class="ms-2">${bounceRate.toFixed(1)}%</span>
                </div>
            </td>
        </tr>
    `;
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
    const topCountries = [...countriesData]
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
    const topCountries = [...countriesData]
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