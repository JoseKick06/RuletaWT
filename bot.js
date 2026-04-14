// --- EXPRESS KEEP-ALIVE PARA RENDER ---
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('¡Bot Discord activo! 😎');
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
});

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = '1399927083580264519';

// Guarda una ruleta distinta por cada servidor
const ultimasRuletas = new Map();

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
        .toJSON(),

    new SlashCommandBuilder()
        .setName('helpwt')
        .setDescription('Muestra cómo usar el bot')
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

// 6️⃣ Listener de comandos
client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const data = ultimasRuletas.get(interaction.guildId);

        if (!data) {
            await interaction.reply({ content: '❌ No hay una ruleta guardada en este servidor.', ephemeral: true });
            return;
        }

        if (interaction.customId === 'repetir_ruleta') {
            let listaJugadores = [...data.listaJugadores].sort(() => Math.random() - 0.5);

            let mitad = Math.ceil(listaJugadores.length / 2);
            let equipoA = listaJugadores.slice(0, mitad);
            let equipoB = listaJugadores.slice(mitad);

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

            ultimasRuletas.set(interaction.guildId, {
                equipoRojo,
                equipoAzul,
                monto: data.monto,
                partidas: data.partidas,
                listaJugadores
            });

            const embed = new EmbedBuilder()
                .setColor(rojoIzquierda ? 0xff3b3b : 0x3b82f6)
                .setTitle('🔄 Ruleta WT Repetida')
                .setDescription(`⚔️ Combate listo entre ${equipoRojo.length} vs ${equipoAzul.length} jugadores`)
                .addFields(
                    {
                        name: '🔴 Equipo Rojo',
                        value: equipoRojo.length ? equipoRojo.map((j, i) => `${i + 1}. ${j}`).join('\\n') : 'Sin jugadores',
                        inline: true
                    },
                    {
                        name: '🔵 Equipo Azul',
                        value: equipoAzul.length ? equipoAzul.map((j, i) => `${i + 1}. ${j}`).join('\\n') : 'Sin jugadores',
                        inline: true
                    },
                    {
                        name: '💰 Apuesta',
                        value: `${data.monto} soles por jugador`,
                        inline: true
                    },
                    {
                        name: '🎮 Games',
                        value: `${data.partidas}`,
                        inline: true
                    }
                )
                .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('repetir_ruleta')
                        .setLabel('🔄 Repetir ruleta')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('pagos_rojo')
                        .setLabel('💸 Pagos rojo')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('pagos_azul')
                        .setLabel('💸 Pagos azul')
                        .setStyle(ButtonStyle.Primary)
                );

            await interaction.reply({ embeds: [embed], components: [row] });
            return;
        }

        const ganador = interaction.customId === 'pagos_rojo' ? 'rojo' : 'azul';
        let equipoGanador, equipoPerdedor;

        if (ganador === 'rojo') {
            equipoGanador = data.equipoRojo;
            equipoPerdedor = data.equipoAzul;
        } else {
            equipoGanador = data.equipoAzul;
            equipoPerdedor = data.equipoRojo;
        }

        let ganadoresAleatorio = equipoGanador.slice().sort(() => Math.random() - 0.5);
        let pagos = [];
        let min = Math.min(equipoPerdedor.length, ganadoresAleatorio.length);

        for (let i = 0; i < min; i++) {
            pagos.push(`• ${equipoPerdedor[i]} paga ${data.monto} soles a ${ganadoresAleatorio[i]}`);
        }
        if (equipoPerdedor.length > ganadoresAleatorio.length) {
            for (let j = ganadoresAleatorio.length; j < equipoPerdedor.length; j++) {
                pagos.push(`• ${equipoPerdedor[j]} no paga (sin pareja)`);
            }
        }
        if (ganadoresAleatorio.length > equipoPerdedor.length) {
            for (let j = equipoPerdedor.length; j < ganadoresAleatorio.length; j++) {
                pagos.push(`• ${ganadoresAleatorio[j]} no recibe pago (sin pareja)`);
            }
        }

        const embedPagos = new EmbedBuilder()
            .setColor(ganador === 'rojo' ? 0xff3b3b : 0x3b82f6)
            .setTitle('💸 Resultados de Pagos')
            .setDescription(`Ganador: **${ganador === 'rojo' ? 'Rojo 🔴' : 'Azul 🔵'}**`)
            .addFields(
                {
                    name: 'Pagos',
                    value: pagos.length ? pagos.join('\\n') : 'Sin pagos',
                    inline: false
                }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.reply({ embeds: [embedPagos], ephemeral: true });
        return;
    }

    if (!interaction.isChatInputCommand()) return;

if (interaction.commandName === 'helpwt') {
    const helpEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('📘 Ayuda de Ruleta WT')
        .setDescription('Estos son los comandos disponibles del bot.')
        .addFields(
            {
                name: '/ruletawt',
                value: 'Genera equipos aleatorios.\nEjemplo: `Juan, Pedro, Luis, Carlos`',
                inline: false
            },
            {
                name: '/pagoswt',
                value: 'Calcula pagos según el equipo ganador: rojo o azul.',
                inline: false
            },
            {
                name: 'Botones',
                value: 'Puedes repetir la ruleta o sacar pagos rojo/azul con un clic.',
                inline: false
            }
        )
        .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
        .setTimestamp();

    await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
    return;
}
  
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

      if (listaJugadores.length < 2) {
    await interaction.reply('❌ Debes ingresar al menos 2 jugadores.');
    return;
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

        // Guarda para pagos por servidor
        ultimasRuletas.set(interaction.guildId, {
    equipoRojo,
    equipoAzul,
    monto,
    partidas,
    listaJugadores
});

        const embed = new EmbedBuilder()
    .setColor(rojoIzquierda ? 0xff3b3b : 0x3b82f6)
    .setTitle('⚔️ Ruleta WT')
    .setDescription(`⚔️ Combate listo entre ${equipoRojo.length} vs ${equipoAzul.length} jugadores`)
    .addFields(
        {
            name: '🔴 Equipo Rojo',
            value: equipoRojo.length ? equipoRojo.map((j, i) => `${i + 1}. ${j}`).join('\n') : 'Sin jugadores',
            inline: true
        },
        {
            name: '🔵 Equipo Azul',
            value: equipoAzul.length ? equipoAzul.map((j, i) => `${i + 1}. ${j}`).join('\n') : 'Sin jugadores',
            inline: true
        },
        {
            name: '💰 Apuesta',
            value: `${monto} soles por jugador`,
            inline: true
        },
        {
            name: '🎮 Games',
            value: `${partidas}`,
            inline: true
        }
    )
    .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
    .setTimestamp();

      const row = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('repetir_ruleta')
            .setLabel('🔄 Repetir ruleta')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('pagos_rojo')
            .setLabel('💸 Pagos rojo')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('pagos_azul')
            .setLabel('💸 Pagos azul')
            .setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
    return;
}

if (interaction.commandName === 'pagoswt') {
      const ganador = interaction.options.getString('ganador');
      const data = ultimasRuletas.get(interaction.guildId);

if (!data) {
    await interaction.reply('❌ Primero debes usar /ruletawt para generar los equipos.');
    return;
}

let equipoGanador, equipoPerdedor;
if (ganador === 'rojo') {
    equipoGanador = data.equipoRojo;
    equipoPerdedor = data.equipoAzul;
} else {
    equipoGanador = data.equipoAzul;
    equipoPerdedor = data.equipoRojo;
}
        let ganadoresAleatorio = equipoGanador.slice().sort(() => Math.random() - 0.5);
let pagos = [];
let min = Math.min(equipoPerdedor.length, ganadoresAleatorio.length);

for (let i = 0; i < min; i++) {
    pagos.push(`• ${equipoPerdedor[i]} paga ${data.monto} soles a ${ganadoresAleatorio[i]}`);
}
if (equipoPerdedor.length > ganadoresAleatorio.length) {
    for (let j = ganadoresAleatorio.length; j < equipoPerdedor.length; j++) {
        pagos.push(`• ${equipoPerdedor[j]} no paga (sin pareja)`);
    }
}
if (ganadoresAleatorio.length > equipoPerdedor.length) {
    for (let j = equipoPerdedor.length; j < ganadoresAleatorio.length; j++) {
        pagos.push(`• ${ganadoresAleatorio[j]} no recibe pago (sin pareja)`);
    }
}

const embedPagos = new EmbedBuilder()
    .setColor(ganador === 'rojo' ? 0xff3b3b : 0x3b82f6)
    .setTitle('💸 Resultados de Pagos')
    .setDescription(`Ganador: **${ganador === 'rojo' ? 'Rojo 🔴' : 'Azul 🔵'}**`)
    .addFields(
        {
            name: 'Pagos',
            value: pagos.length ? pagos.join('\n') : 'Sin pagos',
            inline: false
        }
    )
    .setFooter({ text: `Solicitado por ${interaction.user.tag}` })
    .setTimestamp();

        await interaction.reply({ embeds: [embedPagos] });
        return;
    }
});

client.login(TOKEN);
