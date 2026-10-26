"""Small state-only behavior cloning. No camera, language, RL or task-success claim."""
from pathlib import Path
import time
import numpy as np
from .core import load_numeric,dump,sha256

def features(x,mu,sigma,omega,phase):
    z=np.clip((x-mu)/sigma,-8,8)
    return np.concatenate([np.ones((len(z),1)),z,np.sqrt(2/len(phase))*np.cos(z@omega+phase)],axis=1)

def predict(path,state):
    with np.load(path,allow_pickle=False) as m:
        phi=features(np.atleast_2d(state),m['mu'],m['sigma'],m['omega'],m['phase'])
        return np.atleast_2d(state)+phi@m['weights']

def train(path,out,max_episodes=16):
    out=Path(out)
    if out.exists():raise FileExistsError(f'refusing overwrite: {out}')
    out.mkdir(parents=True)
    started=time.monotonic();s,a,e,f,t=load_numeric(path,max_episodes)
    eps=np.unique(e)
    if len(eps)<6:raise ValueError('need >=6 complete episodes for disjoint splits')
    ntrain=max(2,int(len(eps)*0.625));nval=max(1,int(len(eps)*0.1875))
    split={'train':eps[:ntrain],'validation':eps[ntrain:ntrain+nval],'test':eps[ntrain+nval:]}
    masks={k:np.isin(e,v) for k,v in split.items()}
    mu=s[masks['train']].mean(0);sigma=np.maximum(s[masks['train']].std(0),0.05)
    rng=np.random.default_rng(42);omega=rng.normal(0,0.12,(28,192));phase=rng.uniform(0,2*np.pi,192)
    phi=features(s,mu,sigma,omega,phase);delta=a-s
    p=phi[masks['train']];y=delta[masks['train']]
    choices=[];best=None
    for reg in [0.1,1.,10.]:
        penalty=np.eye(p.shape[1])*reg;penalty[0,0]=0
        weights=np.linalg.solve(p.T@p+penalty,p.T@y)
        val=float(np.sqrt(np.mean((s[masks['validation']]+phi[masks['validation']]@weights-a[masks['validation']])**2)))
        choices.append({'ridge_alpha':reg,'validation_rmse_rad':val})
        if best is None or val<best[0]:best=(val,reg,weights)
    weights=best[2];pred=s+phi@weights;mean=a[masks['train']].mean(0)
    metrics={}
    for name,mask in masks.items():
        metrics[name]={'episodes':split[name].tolist(),'frames':int(mask.sum()),'bc_rmse_rad':float(np.sqrt(np.mean((pred[mask]-a[mask])**2))),'state_identity_rmse_rad':float(np.sqrt(np.mean((s[mask]-a[mask])**2))),'train_mean_rmse_rad':float(np.sqrt(np.mean((mean-a[mask])**2)))}
    np.savez_compressed(out/'policy.npz',mu=mu,sigma=sigma,omega=omega,phase=phase,weights=weights)
    report={'experiment':'state-only residual behavior cloning on public Unitree G1 Dex3 numeric data','dataset_id':'unitreerobotics/G1_Dex3_ToastedBread_Dataset','dataset_revision':'02cb29161f5adb2981a072aa35b408d82a556d07','source_sha256':sha256(path),'seed':42,'features':'28 measured positions + 192 random Fourier features + bias','selected_alpha':best[1],'validation_search':choices,'metrics':metrics,'elapsed_seconds':time.monotonic()-started,'limitations':['numeric subset only; RGB and language not loaded','split by episode within one task, not held-out scenes or operators','offline joint target error is not task success','no learned locomotion, grasp stability or box carrying','no hardware deployment']}
    dump(out/'metrics.json',report)
    np.savez_compressed(out/'evaluation_sample.npz',state=s[e==split['test'][0]],action=a[e==split['test'][0]],prediction=pred[e==split['test'][0]],timestamp=t[e==split['test'][0]],episode=split['test'][0])
    return report
