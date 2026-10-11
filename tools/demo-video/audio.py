"""Original ambient music and tactile sound effects, using Python stdlib."""
import math, wave, array
from pathlib import Path

def write_audio(path: Path, duration: float = 30, rate: int = 48000):
    samples=array.array('h')
    # An original, restrained ambient bed plus tactile dial and shutter sounds.
    chords=[(130.81,196,261.63),(146.83,220,293.66),(164.81,246.94,329.63),(130.81,196,261.63)]
    pluck=[523.25,659.25,783.99,659.25,587.33,783.99,880,783.99]
    for i in range(round(rate*duration)):
        t=i/rate
        chord=chords[min(3,int(t/7.5))]
        fade=min(1,t/1.5,(duration-t)/1.5)
        pad=sum(math.sin(2*math.pi*f*t)+.24*math.sin(2*math.pi*f*2.002*t) for f in chord)*.025
        beat=int(t/0.75); age=t-beat*.75; f=pluck[beat%len(pluck)]
        note=(math.sin(2*math.pi*f*age)+.2*math.sin(2*math.pi*2*f*age))*math.exp(-age*6)*min(1,age/.012)*.045
        click=0
        for mark in (4,9,16,17.6,19.2,21,26,27):
            age=t-mark
            if 0<=age<.1: click+=math.sin(2*math.pi*(1400 if mark!=27 else 800)*age)*math.exp(-age*(110 if mark!=27 else 45))*.09
        value=(pad+note)*max(0,fade)+click
        left=max(-1,min(1,value));right=max(-1,min(1,value+.005*math.sin(2*math.pi*196.3*t)*max(0,fade)))
        samples.extend((int(left*32767),int(right*32767)))
    with wave.open(str(path),'wb') as out:
        out.setnchannels(2);out.setsampwidth(2);out.setframerate(rate);out.writeframes(samples.tobytes())
