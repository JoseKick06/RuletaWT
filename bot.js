// --- EXPRESS KEEP-ALIVE PARA RENDER ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('¡Bot Discord activo! 😎');
});

app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
});

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1399927083580264519';

// Variables globales para la última ruleta
let ultimoEquipoRojo = [];
let ultimoEquipoAzul = [];
let ultimoMonto = 0;

// 1️⃣ Comandos slash
const commands = [
    new SlashCommandBuilder()
        .setName('ruletawt')
        .setDescription('Genera equipos aleatorios con tabla bonita')
        .addStringOption(option =>
            option.setName('jugadores')
                .setDescription('Lista de jugadores (separados por coma o espacio)')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('monto')
                .setDescription('Monto acordado por jugador')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('partidas')
                .setDescription('Cantidad de games')
                .setRequired(true)
        )
        .toJSON(),
    new SlashCommandBuilder()
        .setName('pagoswt')
        .setDescription('Calcula los pagos según el equipo ganador')
        .addStringOption(option =>
            option.setName('ganador')
                .setDescription('Equipo ganador (azul/rojo)')
                .setRequired(true)
                .addChoices(
                    { name: 'Azul', value: 'azul' },
                    { name: 'Rojo', value: 'rojo' }
                )
        )
        .toJSON()
];

// 2️⃣ Registrar comandos en Discord
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Comandos slash registrados.');
    } catch (error) {
        console.error(error);
    }
})();

// 3️⃣ Crear cliente y login
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

client.once('ready', () => {
    console.log(`Bot iniciado como ${client.user.tag}!`);
});

// 4️⃣ Capitaliza y respeta tildes en nombres
function capitalizarNombre(nombre) {
    return nombre
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

// 5️⃣ Función para tabla alineada dinámicamente
function tablaPrideBattle(equipoRojo, equipoAzul, monto, games, rojoIzquierda = true) {
    const numIconos = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    let maxJug = Math.max(equipoRojo.length, equipoAzul.length);

    let maxRojo = Math.max(
        "EQUIPO ROJO  🔴".length, 
        "-----------".length,
        ...equipoRojo.map((n, i) => (`${numIconos[i]} ${n}`).length)
    );
    let maxAzul = Math.max(
        "EQUIPO AZUL  🔵".length,
        "-----------".length,
        ...equipoAzul.map((n, i) => (`${numIconos[i]} ${n}`).length)
    );

    let lines = [];
    lines.push("─────────────────────────────────────────────");
    lines.push("        ⚔️  PRIDE BATTLE HK WRCI  ⚔️");
    lines.push("─────────────────────────────────────────────");

    // 👇 Aquí usas el parámetro rojoIzquierda
    if (rojoIzquierda) {
        lines.push(
            " " +
            "EQUIPO ROJO  🔴".padEnd(maxRojo + 2) +
            "VS".padStart(7).padEnd(7) +
            "EQUIPO AZUL  🔵".padStart(maxAzul + 2)
        );
        lines.push(
            " " +
            "-----------".padEnd(maxRojo + 2) +
            "".padStart(7) +
            "-----------".padStart(maxAzul + 2)
        );
    } else {
        lines.push(
            " " +
            "EQUIPO AZUL  🔵".padEnd(maxAzul + 2) +
            "VS".padStart(7).padEnd(7) +
            "EQUIPO ROJO  🔴".padStart(maxRojo + 2)
        );
        lines.push(
            " " +
            "-----------".padEnd(maxAzul + 2) +
            "".padStart(7) +
            "-----------".padStart(maxRojo + 2)
        );
    }

    for(let i = 0; i < maxJug; i++) {
        let rojo = equipoRojo[i] ? `${numIconos[i]} ${equipoRojo[i]}` : "";
        let azul = equipoAzul[i] ? `${numIconos[i]} ${equipoAzul[i]}` : "";
        if (rojoIzquierda) {
            lines.push(
                " " +
                rojo.padEnd(maxRojo + 2) +
                "".padStart(7) +
                azul.padStart(maxAzul + 2)
            );
        } else {
            lines.push(
                " " +
                azul.padEnd(maxAzul + 2) +
                "".padStart(7) +
                rojo.padStart(maxRojo + 2)
            );
        }
    }
    lines.push("─────────────────────────────────────────────");
    lines.push(`💰  Apuesta: ${monto} soles/jugador`);
    lines.push(`🎮  Games: ${games}`);
    lines.push("🔥 ¡LUCHAR! 🔥");

    return "```\n" + lines.join('\n') + "\n```";
}

// 6️⃣ Listener de comandos
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    // RULETA
    if (interaction.commandName === 'ruletawt') {
        const jugadoresStr = interaction.options.getString('jugadores');
        const monto = interaction.options.getInteger('monto');
        const partidas = interaction.options.getInteger('partidas');

        // Parsing inteligente: acepta comas o solo espacios
        let listaJugadores;
        if (jugadoresStr.includes(',')) {
            listaJugadores = jugadoresStr.split(',').flatMap(j => j.trim().split(/\s+/)).filter(Boolean);
        } else {
            listaJugadores = jugadoresStr.trim().split(/\s+/);
        }

       // Capitaliza y mezcla aleatoriamente
listaJugadores = listaJugadores.map(capitalizarNombre).sort(() => Math.random() - 0.5);

let mitad = Math.ceil(listaJugadores.length / 2);
let equipoA = listaJugadores.slice(0, mitad);
let equipoB = listaJugadores.slice(mitad);

// Asigna el color de los equipos de forma aleatoria
let equipoRojo, equipoAzul, rojoIzquierda;
if (Math.random() < 0.5) {
    equipoRojo = equipoA;
    equipoAzul = equipoB;
    rojoIzquierda = true;
} else {
    equipoRojo = equipoB;
    equipoAzul = equipoA;
    rojoIzquierda = false;
}

        // Guarda para pagos
        ultimoEquipoRojo = equipoRojo;
        ultimoEquipoAzul = equipoAzul;
        ultimoMonto = monto;

        let mensaje = tablaPrideBattle(equipoRojo, equipoAzul, monto, partidas,rojoIzquierda);
    await interaction.reply(mensaje);
    }

    // PAGOS
    if (interaction.commandName === 'pagoswt') {
        const ganador = interaction.options.getString('ganador');
        if (!ultimoEquipoRojo.length || !ultimoEquipoAzul.length || !ultimoMonto) {
            await interaction.reply('❌ Primero debes usar /ruletawt para generar los equipos.');
            return;
        }
        let equipoGanador, equipoPerdedor;
        if (ganador === 'rojo') {
            equipoGanador = ultimoEquipoRojo;
            equipoPerdedor = ultimoEquipoAzul;
        } else {
            equipoGanador = ultimoEquipoAzul;
            equipoPerdedor = ultimoEquipoRojo;
        }
        let ganadoresAleatorio = equipoGanador.slice().sort(() => Math.random() - 0.5);
        let pagos = [];
        let min = Math.min(equipoPerdedor.length, ganadoresAleatorio.length);

        for (let i = 0; i < min; i++) {
            pagos.push(`- ${equipoPerdedor[i]} paga ${ultimoMonto} soles a ${ganadoresAleatorio[i]}`);
        }
        if (equipoPerdedor.length > ganadoresAleatorio.length) {
            for (let j = ganadoresAleatorio.length; j < equipoPerdedor.length; j++) {
                pagos.push(`- ${equipoPerdedor[j]} no paga (sin pareja)`);
            }
        }
        if (ganadoresAleatorio.length > equipoPerdedor.length) {
            for (let j = equipoPerdedor.length; j < ganadoresAleatorio.length; j++) {
                pagos.push(`- ${ganadoresAleatorio[j]} no recibe pago (sin pareja)`);
            }
        }

        let msg = "```\n";
        msg += `💰 Resultados de pagos (${ultimoMonto} soles por jugador):\n\n`;
        msg += pagos.join('\n') + "\n";
        msg += "```";

        await interaction.reply(msg);
    }
});

client.login(TOKEN);
