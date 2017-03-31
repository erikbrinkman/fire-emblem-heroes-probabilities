'use strict';
const https = require('https');
const jsdom = require('jsdom').jsdom;

const categories = ['5★ Focus', '5★', '4★', '3★'];
const probs = [0.03, 0.03, 0.36, 0.58]; // TODO Handle improved probs
const colors = ['Red', 'Green', 'Blue', 'Neutral'];
const data = {};

// FIXME Handle errors

function normalize(name) {
    return name.trim().toLowerCase()
        .replace(/ \(male\)$/, ' (m)')
        .replace(/ \(female\)$/, ' (f)')
        .replace(/ \(mystery of the emblem\)$/, ' (young)')
        .replace(/ \(awakening\)$/, '')
        .replace(/ \(rabbit\)$/, ' (spring festival)');
}

function readEvents(colorMap) {
    jsdom.env('https://fireemblemwiki.org/wiki/List_of_summoning_events_in_Fire_Emblem_Heroes', (err, window) => {
        const events = [];

        window.document.querySelectorAll('#mw-content-text > h3').forEach(header => {
            if (header.textContent !== 'Characters') {
                return;
            }
            const time = header.previousElementSibling.textContent;
            const matches = time.match(/ from (.*) on (.*) to (\d+)(.M UTC) on (.*)\./);
            const startMatches = (matches[1] === 'launch' ? '7AM UTC' : matches[1]).match(/^(\d+)(.M UTC)$/);
            const startTime = new Date(`${matches[2]} ${startMatches[1]}:00 ${startMatches[2]}`);
            const endTime = new Date(`${matches[5]} ${matches[3]}:00 ${matches[4]}`);
            const name = header.previousElementSibling.previousElementSibling.textContent;
            const names = categories.map(_ => []);
            var cat = -1;

            header.nextElementSibling.querySelectorAll('table table td').forEach(row => {
                const catIndex = categories.indexOf(row.textContent.trim());
                if (catIndex < 0) {
                    names[cat].push(normalize(row.textContent));
                } else {
                    cat = catIndex;
                }
            });

            events.push({
                name: name,
                start: startTime,
                end: endTime,
                names: names});
        });

        data.events = events;
        process();
    });
}

function readCharacters() {
    jsdom.env('https://feheroes.wiki/Hero_List', (err, window) => {
        const colorMap = {};
        window.document.querySelectorAll('tr').forEach((row, i) => {
            if (i) {
                const cols = row.children;
                const image = cols[4].querySelector('img').attributes.alt.value;
                const color = colors.map((c, i) => [c, i]).filter(([c, i]) => image.includes(c)).map(([c, i]) => i)[0];
                colorMap[cols[1].textContent.trim().toLowerCase()] = color;
            }
        });

        data.colorMap = colorMap;
        process();
    });
}

function parseFocusEvent(event) {
    const name = event.querySelector('th').textContent.trim().toLowerCase().replace(/^grand battle/, 'battling');
    const img = '//feheroes.wiki' + event.querySelector('img').attributes.srcset.value.split(', ').map(x => x.split(' ')).filter(([_, z]) => z === '1.5x')[0][0];
    return [name, img];
}

function readFocusLists() {
    const images = {};
    var pages = 0;

    function finalize() {
        if (pages < 2) {
            return;
        }

        data.images = images;
        process();
    }

    jsdom.env('https://feheroes.wiki/Summoning_Focus_List', (err, window) => {
        window.document.querySelectorAll('table').forEach(event => {
            const [name, img] = parseFocusEvent(event);
            images[name] = img;
        });
        pages++;
        finalize();
    });

    jsdom.env('https://feheroes.wiki/Summoning_Focus_Archive', (err, window) => {
        window.document.querySelectorAll('table').forEach(event => {
            const [name, img] = parseFocusEvent(event);
            images[name] = img;
        });
        pages++;
        finalize();
    });
}

function process() {
    if (Object.keys(data).length < 3) {
        return;
    }

    data.events.forEach(event => {
        const joint = event.names.map((names, i) => {
            const count = colors.map(_ => 0);
            names.forEach(name => {
                const color = data.colorMap[name];
                if (color === undefined) {
                    console.error(`couldn't find color of "${name}"`);
                } else {
                    count[color] += 1;
                }
            });
            const p = probs[i];
            const sum = count.reduce((a, b) => a + b);
            return count.map(x => x * p / sum);
        });
        const z = joint[0].map((_, i) => joint.map(r => r[i]).reduce((a, b) => a + b));
        event.condProbs = joint.map(row => row.map((c, i) => c / z[i]));

        const lookupName = event.name.replace(/^.*: /, '').toLowerCase();
        const image = data.images[lookupName];
        if (image === undefined) {
            console.error(`couldn't find event named "${lookupName}"`);
        } else {
            event.img = image;
        }

        event.names = undefined;
    });
    
    data.events.sort((a, b) => { const e = b.end - a.end; return e === 0 ? b.start - a.start : e});

    console.log(JSON.stringify({
        rarities: categories,
        colors: colors,
        events: data.events}, null, 2));
}

readCharacters();
readEvents();
readFocusLists();
