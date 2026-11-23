// src/models/transactionModel.js
module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    allocation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    category_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('income', 'expense'),
      allowNull: false,
      defaultValue: 'expense',
    },
    transaction_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    raw_chat: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ai_parsed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    ai_model: {
      type: DataTypes.STRING(100),
      defaultValue: 'Hugging Face (Qwen2.5-7B-Instruct)',
    },
  }, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
  });

  Transaction.associate = (models) => {
    Transaction.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    Transaction.belongsTo(models.FundAllocation, { foreignKey: 'allocation_id', as: 'allocation' });
    Transaction.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
  };

  return Transaction;
};
