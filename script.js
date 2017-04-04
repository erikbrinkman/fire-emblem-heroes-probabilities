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
            const template = document.createElement('template');
            template.innerHTML = `<div class="mdl-card mdl-shadow--2dp card">
            <div class="mdl-card__title card-header"><h2 class="mdl-card__title-text">${event.name}</h2></div>
            <div class="mdl-card__supporting-text">Ran from ${new Date(event.start).toLocaleString()} to ${new Date(event.end).toLocaleString()}</div>
            <div class="mdl-card__menu">
            <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect">
            <i class="material-icons">chevron_left</i>
            </button>
            <button class="mdl-button mdl-js-button mdl-js-ripple-effect"></button>
            <button class="mdl-button mdl-button--icon mdl-js-button mdl-js-ripple-effect">
            <i class="material-icons">chevron_right</i>
            </button>
            </div>
            <table class="mdl-card__media mdl-data-table mdl-js-data-table">
            <thead><tr>
            <th class="mdl-data-table__cell--non-numeric">Rarity</th>
            ${colors.map(x => '<th>' + x + '</th>').join('')}
            </tr></thead>
            <tbody>
            <tr>
            <td class="mdl-data-table__cell--non-numeric">5★ Total</td>
            ${'<td></td>'.repeat(colors.length)}
            </tr>
            ${rarities.map(r => '<tr><td class="mdl-data-table__cell--non-numeric">' + r + '</td>' + '<td></td>'.repeat(colors.length) + '</tr>').join('')}
            </tbody>
            </table>
            </div>`
            const card = template.content.firstChild;
            // The wiki server doesn't like loading too many of these
            headerPictures.push([card.querySelector('.card-header'), event.img]);

            var level = 0;
            const counts = event.count;
            const [down, reset, up] = card.querySelectorAll('.mdl-card__menu > button');
            const [total, ...buckets] = card.querySelectorAll('tbody > tr');

            function update() {
                level = Math.min(Math.max(0, level), 188);
                if (level) {
                    down.removeAttribute('disabled');
                    reset.removeAttribute('disabled');
                } else {
                    down.setAttribute('disabled', '');
                    reset.setAttribute('disabled', '');
                }
                if (level == 188) {
                    up.setAttribute('disabled', '');
                } else {
                    up.removeAttribute('disabled');
                }

                const prob5 = (3 + level * 0.25) / 100;
                reset.textContent = (prob5 * 100).toFixed(2) + '%';
                const prob4 = 0.36 * (1 - prob5 * 2) / 0.94;
                const probs = [prob5, prob5, prob4, 1 - prob5 * 2 - prob4];

                const joint = counts.map((count, i) => {
                    const sum = count.reduce((a, b) => a + b);
                    return count.map(c => c * probs[i] / sum);
                });
                const z = joint[0].map((_, i) => joint.map(r => r[i]).reduce((a, b) => a + b));
                const condProbs = joint.map(row => row.map((c, i) => c / z[i]));
                const total5star = condProbs[0].map((_, i) => condProbs[0][i] + condProbs[1][i]);
                total5star.forEach((p, i) => {
                    total.children[i + 1].textContent = (p * 100).toFixed(2) + '%';
                });
                condProbs.forEach((probs, i) => probs.forEach((p, j) => {
                    buckets[i].children[j + 1].textContent = (p * 100).toFixed(2) + '%';
                }));
            }

            down.addEventListener('click', _ => {
                level--;
                update();
            });
            reset.addEventListener('click', _ => {
                level = 0;
                update();
            });
            up.addEventListener('click', _ => {
                level++;
                update();
            });

            update();
            componentHandler.upgradeElement(template);
            content.appendChild(template.content.firstChild);
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
