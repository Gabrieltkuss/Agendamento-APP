const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const Colaborador = require('../models/colaborador');
const SalaoColaborador = require('../models/relationship/salaoColaborador');
const ColaboradorServico = require('../models/relationship/colaboradorServico');

router.post('/', async (req, res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {
        const { colaborador, salaoId } = req.body;
        let newColaborador = null;
        
        // Verificar se o colaborador existe
        const existentColaborador = await Colaborador.findOne({
            $or: [
                {email: colaborador.email },
                {telefone: colaborador.telefone },
            ],
        });

        // se não existe irei cadastrar
        if (!existentColaborador) {
            // CRIANDO COLABORADOR
            newColaborador = await Colaborador({
                ...colaborador,
                recipientId: 'defaultRecipientId', // Remover o campo recipientId relacionado ao Pagar.me
            }).save({ session });
        }

        // RELACIONAMENTO
        const colaboradorId = existentColaborador 
        ? existentColaborador._id
        : newColaborador._id;

        // Verifica se já existe o relacionamento com o salão
        const existentRelationship = await SalaoColaborador.findOne({
            salaoId,
            colaboradorId,
            status: {$ne: 'E' },
        });

        // Se não está vinculado
        if (!existentRelationship) {
            await new SalaoColaborador({
                salaoId,
                colaboradorId,
                satus: colaborador.vinculo,
            }).save({ session });
        };

        if (existentRelationship && existentRelationship.status === 'I') {
            await SalaoColaborador.findOneAndUpdate(
              {
                salaoId,
                colaboradorId,
              },
              { status: 'A' },
              { session }
            );
        }

        // Se já existir um vinculo entre colaborador e salao
        if (existentColaborador) {
            await SalaoColaborador.findOneAndUpdate({
                salaoId,
                colaboradorId,
            }, 
            { status: colaborador.vinculo },
            { session },
        );
        }

        // relação com as especialidades

        if (Array.isArray(colaborador.especialidades)) {
            await ColaboradorServico.insertMany(
                colaborador.especialidades.map((servicoId) => ({
                    servicoId,
                    colaboradorId,
                })),
                { session }
            );
        }

        await session.commitTransaction();
        session.endSession();

        if (existentColaborador && existentRelationship) {
            res.json({ error: true, message: 'Colaborador já cadastrado.'});
        } else {
            res.json({ error: false });
        }

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error: true, message: err.message });
    }
});

router.put('/:colaboradorId', async (req, res) => {
    try{

        const { vinculo, vinculoId, especialidades } = req.body;
        const { colaboradorId } = req.params;

        // VINCULO

        await SalaoColaborador.findByIdAndUpdate(vinculoId, { status: vinculo });

        // ESPECIALIDADES

        await ColaboradorServico.deleteMany({
            colaboradorId,
        });

        await ColaboradorServico.insertMany(
            especialidades.map((servicoId) => ({
                servicoId,
                colaboradorId,
            })),
        );

        res.json({ error: false });

    } catch (err) {
        res.json({error: true, message: err.message })
    }
});

router.delete('/vinculo/:id', async (req, res) => {
    try {
        await SalaoColaborador.findByIdAndUpdate(req.params.id, { status: 'E' });
        res.json({ error: false });
    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

router.post('/filter', async (req, res) => {
    try {

        const colaboradores = await Colaborador.find(req.body.filters);
        res.json({ error: false, colaboradores });

    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

router.get('/salao/:salaoId', async (req, res) => {
    try {

        const { salaoId } = req.params;
        let listaColaboradores = [];

        // Recuperar Vinculos

        const salaoColaboradores = await SalaoColaborador.find({
            salaoId,
            status: { $ne: 'E'},
        }).populate({ path: 'colaboradorId', select: '-senha -recipientId' })
        .select('colaboradorId dataCadastro status');

        for (let vinculo of salaoColaboradores) {
            const especialidades = await ColaboradorServico.find({
                colaboradorId: vinculo.colaboradorId._id,
            }).populate('servicoId');

            listaColaboradores.push({
                ...vinculo._doc,
                especialidades: especialidades.map(
                    (especialidade) => especialidade.servicoId._id
                ),
            });
        }

        res.json({
            error: false, 
            colaboradores: listaColaboradores.map((vinculo) => ({
                ... vinculo.colaboradorId._doc,
                vinculoId: vinculo._id,
                vinculo: vinculo.status,
                especialidades: vinculo.especialidades,
                dataCadastro: vinculo.dataCadastro,
            })),
        });

    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

module.exports = router;
