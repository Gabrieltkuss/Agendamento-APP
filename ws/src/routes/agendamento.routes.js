const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const util = require('../util');
const moment = require('moment');
const _ = require('lodash');

const Cliente = require('../models/cliente');
const Salao = require('../models/salao');
const Servico = require('../models/servico');
const Colaborador = require('../models/colaborador');
const Agendamento = require('../models/agendamento');
const Horario = require('../models/horario');

function toCents(price) {
    return Math.round(price * 100);
}

router.post('/', async (req, res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();
    try {
        
        const { clienteId, salaoId, servicoId, colaboradorId, data } = req.body;

        // VERIFICAÇÃO SE AINDA EXISTE AQUELE HORÁRIO DISPONÍVEL
         const horarioDisponivel = await Agendamento.findOne({
            salaoId,
            colaboradorId,
            data,
        });

        if (horarioDisponivel) {
            throw new Error('Horário não disponível');
        }

        // RECUPERAR O CLIENTE
        const cliente = await Cliente.findById(clienteId).select('nome endereco customerId');

        //RECUPERAR O SALAO
        const salao = await Salao.findById(salaoId).select('_id');

        //RECUPERAR O SERVIÇO
        const servico = await Servico.findById(servicoId).select('preco titulo comissao');

        //RECUPERAR O COLABORADOR
        const colaborador = await Colaborador.findById(colaboradorId).select('_id');

        // CRIANDO PAGAMENTO
        // PREÇO TOTAL

        const precoFinal = toCents(servico.preco);

        // const colaboradoreSplitRule = {
        //     recipient_id: colaborador.recipientId,
        //     amount: parseInt(precoFinal * (servico.comissao / 100)),
        //   };

        // DADOS DO CARTÃO
        

        // CRIAR AGENDAMENTO
        const agendamento = await new Agendamento({
            ...req.body,
            valor: servico.preco,
        }).save({ session });

        await session.commitTransaction();
        session.endSession();

        res.json({ error:false, agendamento });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error: true, message: err.message });
    }
});

router.post('/filter', async (req, res) => {
    try {

        const { periodo, salaoId } = req.body;
        const agendamentos = await Agendamento.find({
            salaoId,
            data: {
              $gte:   moment(periodo.inicio).startOf('day'),
              $lte: moment(periodo.final).endOf('day'),
            },
        }).populate([
            { path: 'servicoId', select: 'titulo duracao' },
            { path: 'colaboradorId', select: 'nome' },
            { path: 'clienteId', select: 'nome' },
        ]);

        res.json({ error: false, agendamentos })

    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

router.post('/dias-disponiveis', async (req, res) => {
    try {
        const { data, salaoId, servicoId } = req.body;
        const horarios = await Horario.find({ salaoId });
        const servico = await Servico.findById(servicoId).select('duracao');

        let agenda = [];
        let colaboradores = [];
        let lastDay = moment(data);

        // DURACAO DO SERVIÇO
        const servicoMinutos = util.hourToMinutes(moment(servico.duracao).format('HH:mm'));

        const servicoSlots = util.sliceMinutes(
            servico.duracao, 
            moment(servico.duracao).add(servicoMinutos, 'minutes'),
            util.SLOT_DURATION,
        ).length;

        // PROCURE NOS PRÓXIMOS 365 DIAS ATÉ A AGENDA CONTER 7 DIAS DISPONÍVEIS
        for (let i = 0; i <= 365 && agenda.length <= 7; i++) {

            const espacosValidos = horarios.filter((horario) => {
                //VERIFICAR O DIA DA SEMANA
                const diaSemanaDisponivel = horario.dias.includes(moment(lastDay).day()); // 0 - 6

                // VERIFICAR ESPECIALIDADE DISPONÍVEL
                const servicoDisponivel = horario.especialidades.includes(servicoId);

                return diaSemanaDisponivel && servicoDisponivel;
            });

            // TODOS OS COLABORADORES DISPONÍVEIS NO DIA E SEUS HORÁRIOS

            if (espacosValidos.length > 0) {

                let todosHorariosDia = {};

                for (let espaco of espacosValidos) {
                    for (let colaboradorId of espaco.colaboradores) {
                        if (!todosHorariosDia[colaboradorId]) {
                            todosHorariosDia[colaboradorId] = []
                        }

                        // PEGAR TODOS OS HORÁRIOS DO ESPAÇO E JOGAR PARA O COLABORADOR
                        todosHorariosDia[colaboradorId] = [
                            ...todosHorariosDia[colaboradorId],
                            ...util.sliceMinutes(
                                util.mergeDateTime(lastDay, espaco.inicio),
                                util.mergeDateTime(lastDay, espaco.fim),
                                util.SLOT_DURATION
                            )
                        ];
                    }
                }

                // OCUPAÇÃO DE CADA ESPECIALISTA NO DIA
                for (let colaboradorId of Object.keys(todosHorariosDia)) {
                    // RECUPERAR AGENDAMENTOS
                    const agendamentos = await Agendamento.find({
                        colaboradorId,
                        data: {
                            $gte: moment(lastDay).startOf('day'),
                            $lte: moment(lastDay).endOf('day'),
                        },
                    }).select('data servicoId -_id').populate('servicoId', 'duracao');

                    // RECUPERAR HORARIOS AGENDADOS
                    let horariosOcupados = agendamentos.map((agendamento) => ({
                        inicio: moment(agendamento.data),
                        final: moment(agendamento.data).add(util.hourToMinutes(moment(agendamento.servicoId.duracao).format('HH:mm')), 'minutes'),
                    }));

                    // RECUPERAR TODOS OS SLOTS ENTRE OS AGENDAMENTOS
                    horariosOcupados = horariosOcupados.map(horario => util.sliceMinutes(horario.inicio, horario.final, util.SLOT_DURATION)).flat();

                    // REMOVENODO TODOS OS HORARIOS/SLOTS OCUPADOS
                    let horariosLivres = util.splitByValue(todosHorariosDia[colaboradorId].map((horarioLivre) => {
                        return horariosOcupados.includes(horarioLivre) ? '-' : horarioLivre;
                    }), '-').filter((space) => space.length > 0);

                    // VERIFICANDO SE EXISTE ESPAÇO SUFICIENTE NO SLOT
                    horariosLivres = horariosLivres.filter((horarios) => horarios.length >= servicoSlots);

                    // VERIFICANDO SE OS HORARIOS DENTRO DO SLOT TEM A CONTINUIDADE NECESSÁRIA

                    horariosLivres = horariosLivres.map((slot) => slot.filter((horario, index) => slot.length - index >= servicoSlots)).flat();

                    // FORMATANDO HORÁRIOS DE 2 EM 2
                    horariosLivres = _.chunk(horariosLivres, 2);

                    // REMOVER COLABORADOR CASO NÃO TENHA NENHUM ESPAÇO
                    if (horariosLivres.length == 0) {
                        todosHorariosDia = _.omit(todosHorariosDia, colaboradorId);
                    } else {
                        todosHorariosDia[colaboradorId] = horariosLivres;
                    }


                    todosHorariosDia[colaboradorId] = horariosLivres;
                }

                // VERIFICAR SE TEM ESPECIALISTA DISPONÍVEL NAQUELE DIA
                const totalEspecialistas = Object.keys(todosHorariosDia).length;

                if (totalEspecialistas > 0) {
                    colaboradores.push(Object.keys(todosHorariosDia));
                    agenda.push({
                        [lastDay.format('YYYY-MM-DD')]: todosHorariosDia,
                    });
                }

            }

            lastDay = lastDay.add(1, 'day');
        };
        // RECUPERANDO DADOS DOS COLABORADORES
        colaboradores = _.uniq(colaboradores.flat());

        colaboradores = await Colaborador.find({
            _id: { $in: colaboradores },
        }).select('nome foto');

        colaboradores = colaboradores.map(c => ({
            ...c._doc,
            nome: c.nome.split(' ')[0],
        }));

        res.json({ 
        error: false, 
        colaboradores,
        agenda,     
        });

    } catch (err) {
        res.json({error: true, message: err.message});
    }
});

module.exports = router;