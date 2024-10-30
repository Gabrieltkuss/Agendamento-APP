const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const pagarme = require('../services/pagarme');
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
            //Criar conta bancaria
            const { contaBancaria } = colaborador;
            const pagarmeBankAccount = await pagarme('bank_accounts', {
                bank: contaBancaria.banco,
                holder_document: contaBancaria.cpfCnpj,
                type: contaBancaria.tipo,
                branch_number: contaBancaria.agencia,
                account_number: contaBancaria.numero,
                account_check_digit: contaBancaria.dv,
                holder_name: contaBancaria.titular,
            });

            if (pagarmeBankAccount.error) {
                throw pagarmeBankAccount;
            };
    
            //Criar recebedor
            const pagarmeRecipient = await pagarme('/recipients', {
                bank_account_id: pagarmeBankAccount.data.id,
                transfer_interval: 'daily',
                transfer_day: true,
            });

            if (pagarmeBankAccount.error) {
                throw pargarmeReceiver;
            }

            // CRIANDO COLABORADOR
            newColaborador = await Colaborador({
                ...colaborador,
                recipientId: pagarmeRecipient.data.id,
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

        await ColaboradorServico.insertMany(
            colaborador.especialidades.map((servicoId) => ({
                servicoId,
                colaboradorId,
            }), { session })
        );

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


module.exports = router;