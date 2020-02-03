import React, { useCallback, useEffect } from 'react';
import { Button, Typography } from '@material-ui/core';
import { WizardContent } from '../../components/wizards/WizardContent';
import { useStateful } from 'react-hanger';
import { useOrbsAccountStore } from '../../store/storeHooks';
import { ITransactionCreationStepProps } from '../approvableWizardStep/ApprovableWizardStep';
import { observer } from 'mobx-react';
import { fullOrbsFromWeiOrbs } from '../../cryptoUtils/unitConverter';
import { messageFromTxCreationSubStepError, PLEASE_APPROVE_TX_MESSAGE } from '../wizardMessages';

export const OrbsStakingStepContent = observer((props: ITransactionCreationStepProps) => {
  const { disableInputs, onPromiEventAction, txError } = props;

  const orbsAccountStore = useOrbsAccountStore();

  // Start and limit by allowance
  const orbsForStaking = orbsAccountStore.stakingContractAllowance;
  const fullOrbsForStaking = fullOrbsFromWeiOrbs(orbsForStaking);
  const message = useStateful('');
  const subMessage = useStateful('Press "Stake" and accept the transaction');

  // Display the proper error message
  useEffect(() => {
    if (txError) {
      const { errorMessage, errorSubMessage } = messageFromTxCreationSubStepError(txError);
      message.setValue(errorMessage);
      subMessage.setValue(errorSubMessage);
    }
  }, [txError, message, subMessage]);

  const stakeTokens = useCallback(() => {
    message.setValue('');
    subMessage.setValue(PLEASE_APPROVE_TX_MESSAGE);

    const promiEvent = orbsAccountStore.stakeTokens(orbsForStaking);
    onPromiEventAction(promiEvent);
  }, [message, subMessage, orbsAccountStore, orbsForStaking, onPromiEventAction]);

  // TODO : O.L : Use proper grid system instead of the 'br's
  return (
    <WizardContent data-testid={'wizard_sub_step_initiate_staking_tx'}>
      <Typography>In this step you will stake {fullOrbsForStaking} Orbs </Typography>
      <Typography variant={'caption'}>{message.value}</Typography>
      <br />
      <Typography variant={'caption'}>{subMessage.value}</Typography>

      <br />
      <br />

      <Button disabled={disableInputs} onClick={stakeTokens}>
        Stake
      </Button>
    </WizardContent>
  );
});
