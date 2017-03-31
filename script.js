'use strict';
(function() {
    function loadJson(url, callback) {
        var req = new XMLHttpRequest();

        function newCallback() {
            if (req.readyState === 4 && req.status === 200) {
                var json = undefined;
                try {
                    json = JSON.parse(req.responseText);
                } catch(err) {
                    callback(err.message);
                    return;
                }
                callback(undefined, json);
            } else if (req.status !== 200 && req.status !== 0) {
                callback(req.statusText);
                req.removeEventListener('readystatechange', newCallback)
            }
        }

        req.addEventListener('readystatechange', newCallback);
        req.open('GET', url);
        req.send();
    }

    loadJson('data.json', (err, data) => {
        const content = document.querySelector('.page-content');
        const rarities = data.rarities;
        const colors = data.colors;

        var headerPictures = [];

        data.events.forEach((event, i) => {
            const card = document.createElement('div');
            card.classList.add('mdl-card');
            card.classList.add('mdl-shadow--2dp');
            card.classList.add('card');
            const headerDiv = document.createElement('div');
            headerDiv.classList.add('mdl-card__title');
            // The wiki server doesn't like loading too many of these
            headerPictures.push([headerDiv, event.img]);
            const header = document.createElement('h2');
            header.classList.add('mdl-card__title-text');
            header.textContent = event.name;
            headerDiv.appendChild(header);
            card.appendChild(headerDiv);

            const subText = document.createElement('div');
            subText.classList.add('mdl-card__supporting-text');
            subText.textContent = `Ran from ${new Date(event.start).toLocaleString()} to ${new Date(event.end).toLocaleString()}`;
            card.appendChild(subText);

            const table = document.createElement('table');
            table.classList.add('mdl-card__media');
            table.classList.add('mdl-data-table');
            table.classList.add('mdl-js-data-table');

            const tableHead = document.createElement('thead');
            const headRow = document.createElement('tr');
            const firstHead = document.createElement('th');
            firstHead.classList.add('mdl-data-table__cell--non-numeric');
            firstHead.textContent = 'Rarity';
            headRow.appendChild(firstHead);
            colors.forEach(color => {
                const col = document.createElement('th');
                col.textContent = color;
                headRow.appendChild(col);
            });
            tableHead.appendChild(headRow);
            table.appendChild(tableHead);

            const tableBody = document.createElement('tbody');

            const fiveProbs = event.condProbs[0].map((_, i) => event.condProbs[0][i] + event.condProbs[1][i]);
            const fiveRow = document.createElement('tr');
            const firstFiveElem = document.createElement('td');
            firstFiveElem.classList.add('mdl-data-table__cell--non-numeric');
            firstFiveElem.textContent = '5★ Total';
            fiveRow.appendChild(firstFiveElem);
            fiveProbs.forEach(prob => {
                const elem = document.createElement('td');
                elem.textContent = (prob * 100).toPrecision(3) + '%';
                fiveRow.appendChild(elem);
            });
            tableBody.append(fiveRow);

            event.condProbs.forEach((probs, i) => {
                const tableRow = document.createElement('tr');
                const firstElem = document.createElement('td');
                firstElem.classList.add('mdl-data-table__cell--non-numeric');
                firstElem.textContent = rarities[i];
                tableRow.appendChild(firstElem);

                probs.forEach(prob => {
                    const elem = document.createElement('td');
                    elem.textContent = (prob * 100).toPrecision(3) + '%';
                    tableRow.appendChild(elem);
                });
                tableBody.appendChild(tableRow);
            });
            table.appendChild(tableBody);
            card.appendChild(table);

            componentHandler.upgradeElement(card);
            content.appendChild(card);
        })

        function updateImage([elem, url]) {
            const rect = elem.getBoundingClientRect();
            const visible = (rect.top >= 0 &&
                             rect.left >= 0 &&
                             rect.bottom <= window.innerHeight &&
                             rect.right <= window.innerWidth);
            if (visible) {
                elem.style.background = `url("${url}") center / cover`;
            }
            return !visible;
        }

        function updateImages() {
            headerPictures = headerPictures.filter(updateImage);
        }

        window.addEventListener('scroll', updateImages, true);
        updateImages();
    });
})();
