/**
 * Map Module - City Control
 * Leaflet.js with fake markers
 */

const MapModule = (function() {
    'use strict';

    let map = null;
    let tileLayer = null;
    let markersLayer = null;

    const TILES = {
        dark: {
            url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            attr: '&copy; CARTO'
        },
        light: {
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
            attr: '&copy; CARTO'
        }
    };

    const MARKER_COLORS = {
        accident: '#ff3333',
        warning: '#ffc107',
        repair: '#28a745'
    };

    function init() {
        if (map) return map;

        const cities = DataLayer.getCities();
        const currentCity = DataLayer.getCurrentCity();
        const city = cities[currentCity] || cities.moscow;

        map = L.map('map', {
            center: [city.lat, city.lng],
            zoom: city.zoom || 12,
            zoomControl: false
        });

        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        updateTiles();

        // Create markers layer
        markersLayer = L.layerGroup().addTo(map);

        // Load fake markers
        loadMarkers();

        return map;
    }

    function changeCity(city) {
        if (!map || !city) return;

        // Update map center and zoom
        map.setView([city.lat, city.lng], city.zoom || 12, {
            animate: true,
            duration: 1
        });

        // Reload markers for new city
        loadMarkers();
    }

    function updateTiles() {
        if (!map) return;

        const theme = DataLayer.getTheme();
        const config = TILES[theme] || TILES.dark;

        if (tileLayer) {
            map.removeLayer(tileLayer);
        }

        tileLayer = L.tileLayer(config.url, {
            attribution: config.attr,
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);

        tileLayer.bringToBack();
    }

    function createMarkerIcon(type) {
        const color = MARKER_COLORS[type] || '#999';
        
        return L.divIcon({
            className: 'custom-marker-wrapper',
            html: `
                <div class="custom-marker ${type}">
                    <div class="marker-pulse" style="background: ${color}"></div>
                </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -14]
        });
    }

    function loadMarkers() {
        if (!markersLayer) return;

        markersLayer.clearLayers();

        const markers = DataLayer.getMarkers();
        
        markers.forEach(markerData => {
            const { lat, lng, type, title, description, address, authorName, createdAt } = markerData;

            const marker = L.marker([lat, lng], {
                icon: createMarkerIcon(type)
            });

            const typeLabels = {
                accident: 'Авария',
                warning: 'Предупреждение',
                repair: 'Ремонт'
            };

            const popupContent = `
                <div class="popup-title">${title}</div>
                <div class="popup-type">${typeLabels[type] || type}</div>
                <div class="popup-address">${address || ''}</div>
                ${description ? `<div style="margin-top:8px;font-size:0.85rem;color:var(--text-secondary)">${description}</div>` : ''}
                <div class="popup-author">${authorName || 'Аноним'} • ${createdAt ? DataLayer.formatDate(createdAt) : ''}</div>
            `;

            marker.bindPopup(popupContent, {
                maxWidth: 280,
                className: 'custom-popup'
            });

            marker.addTo(markersLayer);
        });
    }

    function onThemeChange() {
        updateTiles();
    }

    function refreshMarkers() {
        loadMarkers();
    }

    return {
        init,
        changeCity,
        onThemeChange,
        refreshMarkers,
        get map() { return map; }
    };
})();

window.MapModule = MapModule;
