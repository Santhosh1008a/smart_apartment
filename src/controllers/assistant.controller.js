const assistantService = require('../services/assistant.service');

exports.chat = async (req, res, next) => {
  try {
    const result = await assistantService.handlePrompt({
      user: req.user,
      complexId: req.complexId,
      message: req.body.message,
      ip: req.ip,
    });

    res.status(200).json({
      success: true,
      ...result,
      data: result.data,
    });
  } catch (err) {
    next(err);
  }
};
