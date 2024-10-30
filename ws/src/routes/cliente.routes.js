const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Cliente = require('../models/cliente');
const SalaoCliente = require('../models/relationship/salaoCliente');
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

router.post('/', async (req, res) => {
    const db = mongoose.connection;
    const session = await db.startSession();
    session.startTransaction();

    try {
        const { cliente, salaoId } = req.body;
        let newCliente = null;

        // Hash da senha
        const salt = await bcrypt.genSalt(10);
        const hashedSenha = await bcrypt.hash(cliente.senha, salt);

        // Verificar se o cliente existe
        const existentCliente = await Cliente.findOne({
            $or: [
                {email: cliente.email },
                {telefone: cliente.telefone },
            ],
        });

        // Se não existe irei cadastrar
        if (!existentCliente) {
            const _id = new mongoose.Types.ObjectId();
            const customerId = new mongoose.Types.ObjectId().toString();

            newCliente = await Cliente({
                ...cliente,
                _id,
                customerId,
                senha: hashedSenha, // Armazene a senha criptografada
                recipientId: 'defaultRecipientId', // Remover o campo recipientId relacionado ao Pagar.me
            }).save({ session });
        }

        // Relacionamento
        const clienteId = existentCliente ? existentCliente._id : newCliente._id;

        // Verifica se já existe o relacionamento com o salão
        const existentRelationship = await SalaoCliente.findOne({
            salaoId,
            clienteId,
            status: {$ne: 'E' },
        });

        if (!existentRelationship) {
            await new SalaoCliente({
                salaoId,
                clienteId,
            }).save({ session });
        }

        if (existentCliente) {
            await SalaoCliente.findOneAndUpdate(
              {
                salaoId,
                clienteId,
              },
              { status: 'A' },
              { session }
            );
        }

        await session.commitTransaction();
        session.endSession();

        if (existentCliente && existentRelationship) {
            res.json({ error: true, message: 'Cliente já cadastrado.'});
        } else {
            res.json({ error: false });
        }

    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.json({ error: true, message: err.message });
    }
});

router.post('/filter', async (req, res) => {
    try {
        const clientes = await Cliente.find(req.body.filters);
        res.json({ error: false, clientes });

    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

router.get('/salao/:salaoId', async (req, res) => {
    try {
        const { salaoId } = req.params;

        const clientes = await SalaoCliente.find({
            salaoId,
            status: { $ne: 'E' },
        })
            .populate('clienteId')
            .select('clienteId dataCadastro');

        res.json({
            error: false,
            clientes: clientes.map((vinculo) => ({
                ...vinculo.clienteId._doc,
                vinculoId: vinculo._id,
                dataCadastro: vinculo.dataCadastro,
            })),
        });

    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

// Rota para excluir o vínculo com o salão
router.delete('/vinculo/:id', async (req, res) => {
    try {
        await SalaoCliente.findByIdAndUpdate(req.params.id, { status: 'E' });
        res.json({ error: false });
    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

// Rota para login do cliente
router.post('/login', async (req, res) => {
    try {
        console.log('Dados recebidos:', req.body);

        const { email, senha } = req.body;

        // Encontrar o cliente pelo email
        const cliente = await Cliente.findOne({ email });

        console.log(cliente);

        if (!cliente) {
            return res.json({ error: true, message: 'Cliente não encontrado.' });
        }

        // Comparar a senha fornecida com o hash armazenado
        const match = await bcrypt.compare(senha, cliente.senha);
        console.log(match);

        if (!match) {
            return res.json({ error: true, message: 'Senha incorreta.' });
        }

        // Sucesso
        res.json({ error: false, cliente });
    } catch (err) {
        res.json({ error: true, message: err.message });
    }
});

module.exports = router;
